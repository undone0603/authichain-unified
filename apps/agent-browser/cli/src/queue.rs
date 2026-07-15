use std::collections::HashMap;
use std::env;
use std::io::{self, BufRead};
use std::thread;
use std::time::Duration;

use async_nats::jetstream::consumer;
use async_nats::jetstream::consumer::pull;
use async_nats::jetstream::stream;
use async_nats::jetstream::AckKind;
use async_nats::Client as NatsClient;
use aws_sdk_sqs::types::MessageAttributeValue;
use aws_sdk_sqs::types::MessageSystemAttributeName;
use aws_sdk_sqs::Client as SqsClient;
use futures_util::StreamExt;
use postgres::{Client as PgClient, NoTls};
use redis::streams::{StreamReadOptions, StreamReadReply};
use redis::{Client, Commands, Connection};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QueueBackend {
    Stdin,
    RedisStreams,
    Sqs,
    Postgres,
    NatsJetStream,
}

impl QueueBackend {
    pub fn as_str(&self) -> &'static str {
        match self {
            QueueBackend::Stdin => "stdin",
            QueueBackend::RedisStreams => "redis-streams",
            QueueBackend::Sqs => "sqs",
            QueueBackend::Postgres => "postgres",
            QueueBackend::NatsJetStream => "nats-jetstream",
        }
    }

    pub fn parse(input: &str) -> Option<Self> {
        match input.trim().to_ascii_lowercase().as_str() {
            "stdin" => Some(QueueBackend::Stdin),
            "redis-streams" | "redis" => Some(QueueBackend::RedisStreams),
            "sqs" => Some(QueueBackend::Sqs),
            "postgres" | "postgresql" => Some(QueueBackend::Postgres),
            "nats-jetstream" | "jetstream" | "nats" => Some(QueueBackend::NatsJetStream),
            _ => None,
        }
    }
}

pub struct QueueMessage {
    pub payload: String,
    pub message_id: Option<String>,
    pub attempts: u32,
}

pub trait JobQueue {
    fn recv(&mut self) -> Result<Option<QueueMessage>, String>;
    fn ack(&mut self, _message: &QueueMessage) -> Result<(), String> {
        Ok(())
    }
    fn nack(&mut self, _message: &QueueMessage, _error: &str) -> Result<(), String> {
        Ok(())
    }
    fn terminal_fail(&mut self, message: &QueueMessage, error: &str) -> Result<(), String> {
        self.nack(message, error)
    }
}

pub struct QueueConfig {
    pub backend: QueueBackend,
}

impl QueueConfig {
    pub fn from_worker_args(clean_args: &[String]) -> Result<Self, String> {
        let mut backend = env::var("AGENT_BROWSER_QUEUE_BACKEND")
            .ok()
            .and_then(|v| QueueBackend::parse(&v))
            .unwrap_or(QueueBackend::Stdin);

        let mut i = 1; // skip "worker"
        while i < clean_args.len() {
            let arg = clean_args[i].as_str();
            if arg == "--queue-backend" {
                let value = clean_args
                    .get(i + 1)
                    .ok_or_else(|| "--queue-backend requires a value".to_string())?;
                backend = QueueBackend::parse(value).ok_or_else(|| {
                    format!(
                        "Invalid --queue-backend '{}'. Expected one of: stdin, redis-streams, sqs, postgres, nats-jetstream",
                        value
                    )
                })?;
                i += 2;
                continue;
            }
            if let Some(value) = arg.strip_prefix("--queue-backend=") {
                backend = QueueBackend::parse(value).ok_or_else(|| {
                    format!(
                        "Invalid --queue-backend '{}'. Expected one of: stdin, redis-streams, sqs, postgres, nats-jetstream",
                        value
                    )
                })?;
                i += 1;
                continue;
            }
            i += 1;
        }

        Ok(QueueConfig { backend })
    }
}

struct StdinQueue {
    reader: io::Lines<io::BufReader<io::StdinLock<'static>>>,
}

impl StdinQueue {
    fn new() -> Self {
        // stdin is process-global and lives for the full process lifetime.
        // We leak a small boxed stdin handle to satisfy the worker loop's
        // long-lived queue interface without adding async runtime complexity.
        let stdin: &'static io::Stdin = Box::leak(Box::new(io::stdin()));
        let lock = stdin.lock();
        let reader = io::BufReader::new(lock).lines();
        Self { reader }
    }
}

impl JobQueue for StdinQueue {
    fn recv(&mut self) -> Result<Option<QueueMessage>, String> {
        match self.reader.next() {
            Some(Ok(line)) => Ok(Some(QueueMessage {
                payload: line,
                message_id: None,
                attempts: 0,
            })),
            Some(Err(e)) => Err(format!("Failed to read worker input line: {}", e)),
            None => Ok(None),
        }
    }
}

struct PostgresQueue {
    client: PgClient,
    table: String,
    consumer: String,
    poll_ms: u64,
    max_attempts: u32,
    claim_ttl_ms: u64,
}

impl PostgresQueue {
    fn new_from_env() -> Result<Self, String> {
        let dsn = env::var("AGENT_BROWSER_PG_QUEUE_DSN").map_err(|_| {
            "AGENT_BROWSER_PG_QUEUE_DSN is required for postgres backend".to_string()
        })?;
        let table =
            env::var("AGENT_BROWSER_PG_QUEUE_TABLE").unwrap_or_else(|_| "agentz_jobs".to_string());
        if !is_safe_table_ident(&table) {
            return Err(format!(
                "Invalid AGENT_BROWSER_PG_QUEUE_TABLE '{}'. Use letters, numbers, underscore, and optional schema prefix.",
                table
            ));
        }
        let poll_ms = env::var("AGENT_BROWSER_PG_POLL_MS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(2000);
        let claim_ttl_ms = env::var("AGENT_BROWSER_PG_CLAIM_TTL_MS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(300_000);
        // Bound retries so poison jobs eventually move to a terminal "failed" state.
        let max_attempts = env::var("AGENT_BROWSER_PG_MAX_ATTEMPTS")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(10);
        let consumer = env::var("AGENT_BROWSER_PG_QUEUE_CONSUMER")
            .unwrap_or_else(|_| format!("{}-{}", hostname::get_display_name(), std::process::id()));

        let mut client = PgClient::connect(&dsn, NoTls)
            .map_err(|e| format!("Failed to connect to Postgres: {}", e))?;
        let create_sql = format!(
            "CREATE TABLE IF NOT EXISTS {} (
                id BIGSERIAL PRIMARY KEY,
                payload TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                attempts INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                claimed_at TIMESTAMPTZ,
                consumer TEXT,
                last_error TEXT,
                ack_at TIMESTAMPTZ
            )",
            table
        );
        client
            .batch_execute(&create_sql)
            .map_err(|e| format!("Failed to ensure queue table exists: {}", e))?;
        let alter_attempts_sql = format!(
            "ALTER TABLE {} ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0",
            table
        );
        client
            .batch_execute(&alter_attempts_sql)
            .map_err(|e| format!("Failed to ensure attempts column exists: {}", e))?;
        let alter_last_error_sql = format!(
            "ALTER TABLE {} ADD COLUMN IF NOT EXISTS last_error TEXT",
            table
        );
        client
            .batch_execute(&alter_last_error_sql)
            .map_err(|e| format!("Failed to ensure last_error column exists: {}", e))?;

        Ok(Self {
            client,
            table,
            consumer,
            poll_ms,
            max_attempts,
            claim_ttl_ms,
        })
    }
}

impl JobQueue for PostgresQueue {
    fn recv(&mut self) -> Result<Option<QueueMessage>, String> {
        let mut tx = self
            .client
            .transaction()
            .map_err(|e| format!("Postgres transaction start failed: {}", e))?;

        // Reclaim stale processing rows so crashed workers do not strand jobs indefinitely.
        let claim_sql = format!(
            "WITH picked AS (
                SELECT id, payload
                FROM {table}
                WHERE (
                    status = 'queued'
                    OR (status = 'processing' AND claimed_at < NOW() - ($2::bigint * INTERVAL '1 millisecond'))
                )
                AND COALESCE(attempts, 0) < {max_attempts}
                ORDER BY id
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE {table} q
            SET status = 'processing',
                claimed_at = NOW(),
                consumer = $1,
                attempts = COALESCE(q.attempts, 0) + 1,
                last_error = NULL
            FROM picked
            WHERE q.id = picked.id
            RETURNING q.id::text, q.payload",
            table = self.table,
            max_attempts = self.max_attempts
        );

        let row_opt = tx
            .query_opt(&claim_sql, &[&self.consumer, &(self.claim_ttl_ms as i64)])
            .map_err(|e| format!("Postgres queue claim failed: {}", e))?;
        tx.commit()
            .map_err(|e| format!("Postgres transaction commit failed: {}", e))?;

        let Some(row) = row_opt else {
            thread::sleep(Duration::from_millis(self.poll_ms));
            return Ok(None);
        };

        let id: String = row.get(0);
        let payload: String = row.get(1);
        Ok(Some(QueueMessage {
            payload,
            message_id: Some(id),
            attempts: 0,
        }))
    }

    fn ack(&mut self, message: &QueueMessage) -> Result<(), String> {
        let Some(id) = &message.message_id else {
            return Ok(());
        };
        let ack_sql = format!(
            "UPDATE {table}
             SET status = 'done', ack_at = NOW(), claimed_at = NULL, consumer = NULL
             WHERE id::text = $1",
            table = self.table
        );
        self.client
            .execute(&ack_sql, &[&id])
            .map_err(|e| format!("Postgres ack failed: {}", e))?;
        Ok(())
    }

    fn nack(&mut self, message: &QueueMessage, error: &str) -> Result<(), String> {
        let Some(id) = &message.message_id else {
            return Ok(());
        };
        let nack_sql = format!(
            "UPDATE {table}
             SET status = CASE
                    WHEN COALESCE(attempts, 0) >= {max_attempts} THEN 'failed'
                    ELSE 'queued'
                 END,
                 claimed_at = NULL,
                 consumer = NULL,
                 last_error = $2
             WHERE id::text = $1",
            table = self.table,
            max_attempts = self.max_attempts
        );
        self.client
            .execute(&nack_sql, &[&id, &error])
            .map_err(|e| format!("Postgres nack failed: {}", e))?;
        Ok(())
    }

    fn terminal_fail(&mut self, message: &QueueMessage, error: &str) -> Result<(), String> {
        let Some(id) = &message.message_id else {
            return Ok(());
        };
        let fail_sql = format!(
            "UPDATE {table}
             SET status = 'failed',
                 claimed_at = NULL,
                 consumer = NULL,
                 last_error = $2
             WHERE id::text = $1",
            table = self.table
        );
        self.client
            .execute(&fail_sql, &[&id, &error])
            .map_err(|e| format!("Postgres terminal fail failed: {}", e))?;
        Ok(())
    }
}

struct RedisStreamsQueue {
    conn: Connection,
    stream: String,
    group: String,
    consumer: String,
    block_ms: usize,
    claim_idle_ms: u64,
    max_attempts: u32,
    failed_stream: String,
    supports_autoclaim: bool,
}

struct SqsQueue {
    rt: tokio::runtime::Runtime,
    client: SqsClient,
    queue_url: String,
    wait_seconds: i32,
    max_attempts: u32,
    dlq_url: Option<String>,
}

struct NatsJetStreamQueue {
    rt: tokio::runtime::Runtime,
    client: NatsClient,
    stream: String,
    consumer: String,
    fetch_timeout_ms: u64,
    max_attempts: u32,
    failed_subject: String,
    pending: HashMap<String, async_nats::jetstream::Message>,
}

impl SqsQueue {
    fn new_from_env() -> Result<Self, String> {
        let queue_url = env::var("AGENT_BROWSER_SQS_QUEUE_URL")
            .map_err(|_| "AGENT_BROWSER_SQS_QUEUE_URL is required for sqs backend".to_string())?;
        if queue_url.trim().is_empty() {
            return Err("AGENT_BROWSER_SQS_QUEUE_URL cannot be empty".to_string());
        }

        let wait_seconds = env::var("AGENT_BROWSER_SQS_WAIT_SECONDS")
            .ok()
            .and_then(|v| v.parse::<i32>().ok())
            .filter(|v| *v >= 0 && *v <= 20)
            .unwrap_or(20);
        let max_attempts = env::var("AGENT_BROWSER_SQS_MAX_ATTEMPTS")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(10);
        let dlq_url = env::var("AGENT_BROWSER_SQS_DLQ_URL").ok().and_then(|v| {
            if v.trim().is_empty() {
                None
            } else {
                Some(v)
            }
        });

        let rt =
            tokio::runtime::Runtime::new().map_err(|e| format!("Tokio runtime error: {}", e))?;
        let config = rt.block_on(async {
            aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await
        });
        let client = SqsClient::new(&config);

        Ok(Self {
            rt,
            client,
            queue_url,
            wait_seconds,
            max_attempts,
            dlq_url,
        })
    }

    fn parse_attempts(
        attrs: Option<
            &std::collections::HashMap<String, aws_sdk_sqs::types::MessageAttributeValue>,
        >,
        system_attrs: Option<&std::collections::HashMap<MessageSystemAttributeName, String>>,
    ) -> u32 {
        let custom = attrs
            .and_then(|m| m.get("agentz_attempts"))
            .and_then(|v| v.string_value())
            .and_then(|s| s.parse::<u32>().ok());
        let receive_count = system_attrs
            .and_then(|m| m.get(&MessageSystemAttributeName::ApproximateReceiveCount))
            .and_then(|s| s.parse::<u32>().ok());
        custom
            .or(receive_count.map(|v| v.saturating_sub(1)))
            .unwrap_or(0)
    }

    fn build_attempts_attr(attempts: u32) -> Result<MessageAttributeValue, String> {
        MessageAttributeValue::builder()
            .data_type("Number")
            .string_value(attempts.to_string())
            .build()
            .map_err(|e| format!("Failed to build SQS attempts attribute: {}", e))
    }

    fn build_error_attr(error: &str) -> Result<MessageAttributeValue, String> {
        let capped = if error.len() > 500 {
            &error[..500]
        } else {
            error
        };
        MessageAttributeValue::builder()
            .data_type("String")
            .string_value(capped)
            .build()
            .map_err(|e| format!("Failed to build SQS error attribute: {}", e))
    }
}

impl NatsJetStreamQueue {
    fn new_from_env() -> Result<Self, String> {
        let nats_url = env::var("AGENT_BROWSER_NATS_URL")
            .unwrap_or_else(|_| "nats://127.0.0.1:4222".to_string());
        let stream = env::var("AGENT_BROWSER_NATS_STREAM").map_err(|_| {
            "AGENT_BROWSER_NATS_STREAM is required for nats-jetstream backend".to_string()
        })?;
        let subject =
            env::var("AGENT_BROWSER_NATS_SUBJECT").unwrap_or_else(|_| "agentz.jobs".to_string());
        let consumer = env::var("AGENT_BROWSER_NATS_CONSUMER")
            .unwrap_or_else(|_| "agent-browser-workers".to_string());
        let fetch_timeout_ms = env::var("AGENT_BROWSER_NATS_FETCH_TIMEOUT_MS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(5000);
        let ack_wait_ms = env::var("AGENT_BROWSER_NATS_ACK_WAIT_MS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(30_000);
        let max_attempts = env::var("AGENT_BROWSER_NATS_MAX_ATTEMPTS")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(10);
        let failed_subject = env::var("AGENT_BROWSER_NATS_FAILED_SUBJECT")
            .unwrap_or_else(|_| format!("{}.failed", subject));

        let rt =
            tokio::runtime::Runtime::new().map_err(|e| format!("Tokio runtime error: {}", e))?;
        let client = rt
            .block_on(async { async_nats::connect(nats_url).await })
            .map_err(|e| format!("Failed to connect to NATS: {}", e))?;

        rt.block_on(async {
            let js = async_nats::jetstream::new(client.clone());
            let _ = js
                .get_or_create_stream(stream::Config {
                    name: stream.clone(),
                    subjects: vec![subject.clone(), failed_subject.clone()],
                    ..Default::default()
                })
                .await
                .map_err(|e| format!("Failed to ensure JetStream stream '{}': {}", stream, e))?;

            let _: consumer::Consumer<pull::Config> = js
                .create_consumer_on_stream(
                    pull::Config {
                        durable_name: Some(consumer.clone()),
                        filter_subject: subject.clone(),
                        ack_policy: consumer::AckPolicy::Explicit,
                        ack_wait: Duration::from_millis(ack_wait_ms),
                        max_deliver: max_attempts as i64,
                        ..Default::default()
                    },
                    &stream,
                )
                .await
                .map_err(|e| {
                    format!(
                        "Failed to ensure JetStream consumer '{}' on stream '{}': {}",
                        consumer, stream, e
                    )
                })?;
            Ok::<(), String>(())
        })?;

        Ok(Self {
            rt,
            client,
            stream,
            consumer,
            fetch_timeout_ms,
            max_attempts,
            failed_subject,
            pending: HashMap::new(),
        })
    }
}

impl RedisStreamsQueue {
    fn new_from_env() -> Result<Self, String> {
        let redis_url = env::var("AGENT_BROWSER_REDIS_URL")
            .unwrap_or_else(|_| "redis://127.0.0.1/".to_string());
        let stream = env::var("AGENT_BROWSER_REDIS_STREAM").map_err(|_| {
            "AGENT_BROWSER_REDIS_STREAM is required for redis-streams backend".to_string()
        })?;
        if stream.trim().is_empty() {
            return Err("AGENT_BROWSER_REDIS_STREAM cannot be empty".to_string());
        }

        let group = env::var("AGENT_BROWSER_REDIS_GROUP")
            .unwrap_or_else(|_| "agent-browser-workers".to_string());
        let consumer = env::var("AGENT_BROWSER_REDIS_CONSUMER")
            .unwrap_or_else(|_| format!("{}-{}", hostname::get_display_name(), std::process::id()));
        let block_ms = env::var("AGENT_BROWSER_REDIS_BLOCK_MS")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(5000);
        let claim_idle_ms = env::var("AGENT_BROWSER_REDIS_CLAIM_IDLE_MS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(300_000);
        let max_attempts = env::var("AGENT_BROWSER_REDIS_MAX_ATTEMPTS")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(10);
        let failed_stream = env::var("AGENT_BROWSER_REDIS_FAILED_STREAM")
            .unwrap_or_else(|_| format!("{}:failed", stream));

        let client = Client::open(redis_url.as_str())
            .map_err(|e| format!("Invalid AGENT_BROWSER_REDIS_URL: {}", e))?;
        let mut conn = client
            .get_connection()
            .map_err(|e| format!("Failed to connect to Redis: {}", e))?;

        // Ensure group exists; BUSYGROUP means already created.
        let create_result: redis::RedisResult<()> = redis::cmd("XGROUP")
            .arg("CREATE")
            .arg(&stream)
            .arg(&group)
            .arg("$")
            .arg("MKSTREAM")
            .query(&mut conn);
        if let Err(err) = create_result {
            let msg = err.to_string();
            if !msg.contains("BUSYGROUP") {
                return Err(format!(
                    "Failed to create consumer group '{}' on stream '{}': {}",
                    group, stream, msg
                ));
            }
        }

        Ok(Self {
            conn,
            stream,
            group,
            consumer,
            block_ms,
            claim_idle_ms,
            max_attempts,
            failed_stream,
            supports_autoclaim: true,
        })
    }

    fn try_autoclaim(&mut self) -> Result<Option<QueueMessage>, String> {
        let reply: redis::Value = redis::cmd("XAUTOCLAIM")
            .arg(&self.stream)
            .arg(&self.group)
            .arg(&self.consumer)
            .arg(self.claim_idle_ms)
            .arg("0-0")
            .arg("COUNT")
            .arg(1)
            .query(&mut self.conn)
            .map_err(|e| format!("Redis XAUTOCLAIM failed: {}", e))?;

        parse_xautoclaim_reply(&reply)
    }
}

impl JobQueue for RedisStreamsQueue {
    fn recv(&mut self) -> Result<Option<QueueMessage>, String> {
        if self.supports_autoclaim {
            match self.try_autoclaim() {
                Ok(Some(msg)) => return Ok(Some(msg)),
                Ok(None) => {}
                Err(err) => {
                    let is_unsupported = err.contains("unknown command")
                        || err.contains("ERR unknown")
                        || err.contains("wrong number of arguments for 'xautoclaim'");
                    if is_unsupported {
                        self.supports_autoclaim = false;
                    } else {
                        return Err(err);
                    }
                }
            }
        }

        let options = StreamReadOptions::default()
            .group(&self.group, &self.consumer)
            .count(1)
            .block(self.block_ms);

        let reply: StreamReadReply = self
            .conn
            .xread_options(&[self.stream.as_str()], &[">"], &options)
            .map_err(|e| format!("Redis XREADGROUP failed: {}", e))?;

        let Some(key) = reply.keys.first() else {
            return Ok(None);
        };
        let Some(entry) = key.ids.first() else {
            return Ok(None);
        };

        let payload = entry
            .map
            .get("payload")
            .or_else(|| entry.map.get("job"))
            .or_else(|| entry.map.get("body"))
            .and_then(|v| redis::from_redis_value::<String>(v).ok())
            .or_else(|| {
                if entry.map.len() == 1 {
                    let (_, v) = entry.map.iter().next()?;
                    redis::from_redis_value::<String>(v).ok()
                } else {
                    None
                }
            })
            .ok_or_else(|| {
                "Redis stream message missing string payload field; expected payload/job/body"
                    .to_string()
            })?;
        let attempts = entry
            .map
            .get("attempts")
            .and_then(|v| redis::from_redis_value::<i64>(v).ok())
            .and_then(|v| u32::try_from(v).ok())
            .unwrap_or(0);

        Ok(Some(QueueMessage {
            payload,
            message_id: Some(entry.id.clone()),
            attempts,
        }))
    }

    fn ack(&mut self, message: &QueueMessage) -> Result<(), String> {
        let Some(id) = &message.message_id else {
            return Ok(());
        };
        let _: i32 = self
            .conn
            .xack(&self.stream, &self.group, &[id.as_str()])
            .map_err(|e| format!("Redis XACK failed: {}", e))?;
        Ok(())
    }

    fn nack(&mut self, message: &QueueMessage, error: &str) -> Result<(), String> {
        let Some(id) = &message.message_id else {
            return Ok(());
        };

        let next_attempts = message.attempts.saturating_add(1);
        if next_attempts >= self.max_attempts {
            let failed_add: redis::RedisResult<String> = redis::cmd("XADD")
                .arg(&self.failed_stream)
                .arg("*")
                .arg("payload")
                .arg(&message.payload)
                .arg("attempts")
                .arg(next_attempts)
                .arg("error")
                .arg(error)
                .query(&mut self.conn);
            failed_add.map_err(|e| format!("Redis dead-letter XADD failed: {}", e))?;
        } else {
            let requeue_add: redis::RedisResult<String> = redis::cmd("XADD")
                .arg(&self.stream)
                .arg("*")
                .arg("payload")
                .arg(&message.payload)
                .arg("attempts")
                .arg(next_attempts)
                .arg("error")
                .arg(error)
                .query(&mut self.conn);
            requeue_add.map_err(|e| format!("Redis requeue XADD failed: {}", e))?;
        }

        let _: i32 = self
            .conn
            .xack(&self.stream, &self.group, &[id.as_str()])
            .map_err(|e| format!("Redis XACK after nack failed: {}", e))?;
        Ok(())
    }

    fn terminal_fail(&mut self, message: &QueueMessage, error: &str) -> Result<(), String> {
        let Some(id) = &message.message_id else {
            return Ok(());
        };
        let terminal_attempts = message.attempts.saturating_add(1).max(self.max_attempts);
        let failed_add: redis::RedisResult<String> = redis::cmd("XADD")
            .arg(&self.failed_stream)
            .arg("*")
            .arg("payload")
            .arg(&message.payload)
            .arg("attempts")
            .arg(terminal_attempts)
            .arg("error")
            .arg(error)
            .query(&mut self.conn);
        failed_add.map_err(|e| format!("Redis terminal fail XADD failed: {}", e))?;

        let _: i32 = self
            .conn
            .xack(&self.stream, &self.group, &[id.as_str()])
            .map_err(|e| format!("Redis XACK after terminal fail failed: {}", e))?;
        Ok(())
    }
}

impl JobQueue for SqsQueue {
    fn recv(&mut self) -> Result<Option<QueueMessage>, String> {
        let queue_url = self.queue_url.clone();
        let wait_seconds = self.wait_seconds;
        let output = self.rt.block_on(async {
            self.client
                .receive_message()
                .queue_url(queue_url)
                .max_number_of_messages(1)
                .wait_time_seconds(wait_seconds)
                .message_system_attribute_names(MessageSystemAttributeName::ApproximateReceiveCount)
                .message_attribute_names("All")
                .send()
                .await
        });
        let resp = output.map_err(|e| format!("SQS receive_message failed: {}", e))?;
        let Some(msg) = resp.messages().first() else {
            return Ok(None);
        };

        let payload = msg
            .body()
            .map(|s| s.to_string())
            .ok_or_else(|| "SQS message missing body".to_string())?;
        let receipt = msg
            .receipt_handle()
            .map(|s| s.to_string())
            .ok_or_else(|| "SQS message missing receipt_handle".to_string())?;
        let attempts = Self::parse_attempts(msg.message_attributes(), msg.attributes());

        Ok(Some(QueueMessage {
            payload,
            message_id: Some(receipt),
            attempts,
        }))
    }

    fn ack(&mut self, message: &QueueMessage) -> Result<(), String> {
        let Some(receipt_handle) = &message.message_id else {
            return Ok(());
        };
        let queue_url = self.queue_url.clone();
        let rh = receipt_handle.clone();
        let output = self.rt.block_on(async {
            self.client
                .delete_message()
                .queue_url(queue_url)
                .receipt_handle(rh)
                .send()
                .await
        });
        output.map_err(|e| format!("SQS delete_message failed: {}", e))?;
        Ok(())
    }

    fn nack(&mut self, message: &QueueMessage, error: &str) -> Result<(), String> {
        let Some(receipt_handle) = &message.message_id else {
            return Ok(());
        };
        let next_attempts = message.attempts.saturating_add(1);
        if next_attempts >= self.max_attempts {
            let dlq = self.dlq_url.clone().ok_or_else(|| {
                format!(
                    "SQS max attempts ({}) reached but AGENT_BROWSER_SQS_DLQ_URL is not set",
                    self.max_attempts
                )
            })?;
            let payload = message.payload.clone();
            let attempts_attr = Self::build_attempts_attr(next_attempts)?;
            let error_attr = Self::build_error_attr(error)?;
            let send_output = self.rt.block_on(async {
                self.client
                    .send_message()
                    .queue_url(dlq)
                    .message_body(payload)
                    .message_attributes("agentz_attempts", attempts_attr)
                    .message_attributes("agentz_error", error_attr)
                    .send()
                    .await
            });
            send_output.map_err(|e| format!("SQS send_message to DLQ failed: {}", e))?;
            return self.ack(message);
        }

        let queue_url = self.queue_url.clone();
        let payload = message.payload.clone();
        let attempts_attr = Self::build_attempts_attr(next_attempts)?;
        let error_attr = Self::build_error_attr(error)?;
        let requeue_output = self.rt.block_on(async {
            self.client
                .send_message()
                .queue_url(queue_url)
                .message_body(payload)
                .message_attributes("agentz_attempts", attempts_attr)
                .message_attributes("agentz_error", error_attr)
                .send()
                .await
        });
        requeue_output.map_err(|e| format!("SQS requeue send_message failed: {}", e))?;

        let _ = receipt_handle; // keep explicit usage in this code path
        self.ack(message)
    }

    fn terminal_fail(&mut self, message: &QueueMessage, error: &str) -> Result<(), String> {
        if let Some(dlq) = self.dlq_url.clone() {
            let payload = message.payload.clone();
            let terminal_attempts = message.attempts.saturating_add(1).max(self.max_attempts);
            let attempts_attr = Self::build_attempts_attr(terminal_attempts)?;
            let error_attr = Self::build_error_attr(error)?;
            let send_output = self.rt.block_on(async {
                self.client
                    .send_message()
                    .queue_url(dlq)
                    .message_body(payload)
                    .message_attributes("agentz_attempts", attempts_attr)
                    .message_attributes("agentz_error", error_attr)
                    .send()
                    .await
            });
            send_output.map_err(|e| format!("SQS terminal fail send_message failed: {}", e))?;
        }
        self.ack(message)
    }
}

impl JobQueue for NatsJetStreamQueue {
    fn recv(&mut self) -> Result<Option<QueueMessage>, String> {
        let stream_name = self.stream.clone();
        let consumer_name = self.consumer.clone();
        let timeout = self.fetch_timeout_ms;
        let result = self.rt.block_on(async {
            let js = async_nats::jetstream::new(self.client.clone());
            let consumer: consumer::Consumer<pull::Config> = js
                .get_consumer_from_stream(&consumer_name, &stream_name)
                .await
                .map_err(|e| format!("JetStream get_consumer failed: {}", e))?;

            let mut messages: pull::Batch = consumer
                .fetch()
                .max_messages(1)
                .expires(Duration::from_millis(timeout))
                .messages()
                .await
                .map_err(|e| format!("JetStream fetch failed: {}", e))?;

            let Some(next) = messages.next().await else {
                return Ok(None);
            };
            let msg = next.map_err(|e| format!("JetStream message receive failed: {}", e))?;
            Ok::<Option<async_nats::jetstream::Message>, String>(Some(msg))
        })?;

        let Some(msg) = result else {
            return Ok(None);
        };

        let payload = String::from_utf8(msg.message.payload.to_vec())
            .map_err(|e| format!("JetStream message payload is not UTF-8: {}", e))?;
        let attempts = msg
            .info()
            .ok()
            .map(|i| i.delivered.saturating_sub(1))
            .and_then(|v| u32::try_from(v).ok())
            .unwrap_or(0);
        let message_id = uuid::Uuid::new_v4().to_string();
        self.pending.insert(message_id.clone(), msg);

        Ok(Some(QueueMessage {
            payload,
            message_id: Some(message_id),
            attempts,
        }))
    }

    fn ack(&mut self, message: &QueueMessage) -> Result<(), String> {
        let Some(id) = &message.message_id else {
            return Ok(());
        };
        let Some(msg) = self.pending.remove(id) else {
            return Ok(());
        };
        self.rt
            .block_on(async { msg.ack().await })
            .map_err(|e| format!("JetStream ack failed: {}", e))?;
        Ok(())
    }

    fn nack(&mut self, message: &QueueMessage, _error: &str) -> Result<(), String> {
        let Some(id) = &message.message_id else {
            return Ok(());
        };
        let Some(msg) = self.pending.remove(id) else {
            return Ok(());
        };
        let next_attempts = message.attempts.saturating_add(1);
        if next_attempts >= self.max_attempts {
            let failed_subject = self.failed_subject.clone();
            let payload = msg.message.payload.clone();
            self.rt
                .block_on(async { self.client.publish(failed_subject, payload).await })
                .map_err(|e| format!("JetStream publish to failed subject failed: {}", e))?;
            self.rt
                .block_on(async { msg.ack_with(AckKind::Term).await })
                .map_err(|e| format!("JetStream terminal ack failed: {}", e))?;
            return Ok(());
        }

        self.rt
            .block_on(async { msg.ack_with(AckKind::Nak(None)).await })
            .map_err(|e| format!("JetStream nack failed: {}", e))?;
        Ok(())
    }

    fn terminal_fail(&mut self, message: &QueueMessage, _error: &str) -> Result<(), String> {
        let Some(id) = &message.message_id else {
            return Ok(());
        };
        let Some(msg) = self.pending.remove(id) else {
            return Ok(());
        };
        let failed_subject = self.failed_subject.clone();
        let payload = msg.message.payload.clone();
        self.rt
            .block_on(async { self.client.publish(failed_subject, payload).await })
            .map_err(|e| format!("JetStream terminal fail publish failed: {}", e))?;
        self.rt
            .block_on(async { msg.ack_with(AckKind::Term).await })
            .map_err(|e| format!("JetStream terminal fail ack failed: {}", e))?;
        Ok(())
    }
}

pub fn create_queue(config: &QueueConfig) -> Box<dyn JobQueue> {
    match config.backend {
        QueueBackend::Stdin => Box::new(StdinQueue::new()),
        QueueBackend::RedisStreams => match RedisStreamsQueue::new_from_env() {
            Ok(queue) => Box::new(queue),
            Err(err) => Box::new(FailedQueue::new(err)),
        },
        QueueBackend::Sqs => match SqsQueue::new_from_env() {
            Ok(queue) => Box::new(queue),
            Err(err) => Box::new(FailedQueue::new(err)),
        },
        QueueBackend::Postgres => match PostgresQueue::new_from_env() {
            Ok(queue) => Box::new(queue),
            Err(err) => Box::new(FailedQueue::new(err)),
        },
        QueueBackend::NatsJetStream => match NatsJetStreamQueue::new_from_env() {
            Ok(queue) => Box::new(queue),
            Err(err) => Box::new(FailedQueue::new(err)),
        },
    }
}

struct FailedQueue {
    error: String,
}

impl FailedQueue {
    fn new(error: String) -> Self {
        Self { error }
    }
}

impl JobQueue for FailedQueue {
    fn recv(&mut self) -> Result<Option<QueueMessage>, String> {
        Err(self.error.clone())
    }
}

mod hostname {
    pub fn get_display_name() -> String {
        std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .unwrap_or_else(|_| "worker".to_string())
    }
}

fn redis_value_to_string(value: &redis::Value) -> Option<String> {
    redis::from_redis_value::<String>(value).ok()
}

fn redis_value_to_u32(value: &redis::Value) -> Option<u32> {
    redis::from_redis_value::<i64>(value)
        .ok()
        .and_then(|v| u32::try_from(v).ok())
        .or_else(|| redis_value_to_string(value).and_then(|s| s.parse::<u32>().ok()))
}

fn parse_payload_and_attempts(fields: &[redis::Value]) -> Option<(String, u32)> {
    if fields.len() % 2 != 0 {
        return None;
    }

    let mut payload: Option<String> = None;
    let mut attempts: u32 = 0;
    let mut i = 0usize;
    while i + 1 < fields.len() {
        let key = redis_value_to_string(&fields[i])?;
        let value = &fields[i + 1];
        match key.as_str() {
            "payload" | "job" | "body" => payload = redis_value_to_string(value),
            "attempts" => {
                if let Some(v) = redis_value_to_u32(value) {
                    attempts = v;
                }
            }
            _ => {}
        }
        i += 2;
    }

    payload.map(|p| (p, attempts))
}

fn parse_xautoclaim_reply(reply: &redis::Value) -> Result<Option<QueueMessage>, String> {
    let redis::Value::Array(top) = reply else {
        return Err("Unexpected XAUTOCLAIM response type".to_string());
    };
    if top.len() < 2 {
        return Err("Unexpected XAUTOCLAIM response shape".to_string());
    }

    let redis::Value::Array(entries) = &top[1] else {
        return Err("Unexpected XAUTOCLAIM entries shape".to_string());
    };
    let Some(redis::Value::Array(entry)) = entries.first() else {
        return Ok(None);
    };
    if entry.len() != 2 {
        return Err("Unexpected XAUTOCLAIM entry shape".to_string());
    }

    let id = redis_value_to_string(&entry[0])
        .ok_or_else(|| "XAUTOCLAIM entry id missing or invalid".to_string())?;
    let redis::Value::Array(fields) = &entry[1] else {
        return Err("XAUTOCLAIM entry fields shape invalid".to_string());
    };
    let (payload, attempts) = parse_payload_and_attempts(fields)
        .ok_or_else(|| "XAUTOCLAIM entry missing payload field".to_string())?;

    Ok(Some(QueueMessage {
        payload,
        message_id: Some(id),
        attempts,
    }))
}

fn is_safe_table_ident(ident: &str) -> bool {
    if ident.is_empty() {
        return false;
    }
    for part in ident.split('.') {
        if part.is_empty() {
            return false;
        }
        let mut chars = part.chars();
        let Some(first) = chars.next() else {
            return false;
        };
        if !(first.is_ascii_alphabetic() || first == '_') {
            return false;
        }
        if chars.any(|c| !(c.is_ascii_alphanumeric() || c == '_')) {
            return false;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use redis::Value;
    use std::sync::{Mutex, OnceLock};

    static INTEGRATION_ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    fn integration_env_lock() -> &'static Mutex<()> {
        INTEGRATION_ENV_LOCK.get_or_init(|| Mutex::new(()))
    }

    fn set_env_vars(vars: &[(&str, String)]) -> Vec<(String, Option<String>)> {
        let mut previous = Vec::with_capacity(vars.len());
        for (key, value) in vars {
            previous.push(((*key).to_string(), std::env::var(key).ok()));
            std::env::set_var(key, value);
        }
        previous
    }

    fn restore_env_vars(previous: Vec<(String, Option<String>)>) {
        for (key, value) in previous {
            if let Some(value) = value {
                std::env::set_var(&key, value);
            } else {
                std::env::remove_var(&key);
            }
        }
    }

    fn integration_prefix(name: &str) -> String {
        format!("agent-browser-it-{}-{}", name, uuid::Uuid::new_v4())
    }

    #[test]
    fn test_backend_parse_variants() {
        assert_eq!(QueueBackend::parse("stdin"), Some(QueueBackend::Stdin));
        assert_eq!(
            QueueBackend::parse("redis-streams"),
            Some(QueueBackend::RedisStreams)
        );
        assert_eq!(QueueBackend::parse("sqs"), Some(QueueBackend::Sqs));
        assert_eq!(
            QueueBackend::parse("postgres"),
            Some(QueueBackend::Postgres)
        );
        assert_eq!(
            QueueBackend::parse("nats-jetstream"),
            Some(QueueBackend::NatsJetStream)
        );
    }

    #[test]
    fn test_safe_table_ident_validation() {
        assert!(is_safe_table_ident("agentz_jobs"));
        assert!(is_safe_table_ident("public.agentz_jobs"));
        assert!(!is_safe_table_ident("public.agentz-jobs"));
        assert!(!is_safe_table_ident("public.agentz jobs"));
        assert!(!is_safe_table_ident("public.agentz_jobs;DROP"));
        assert!(!is_safe_table_ident("9jobs"));
    }

    #[test]
    fn test_parse_xautoclaim_reply_empty() {
        let reply = Value::Array(vec![
            Value::BulkString(b"0-0".to_vec()),
            Value::Array(vec![]),
        ]);
        let msg = parse_xautoclaim_reply(&reply).expect("parse should succeed");
        assert!(msg.is_none());
    }

    #[test]
    fn test_parse_xautoclaim_reply_with_payload_and_attempts() {
        let reply = Value::Array(vec![
            Value::BulkString(b"0-0".to_vec()),
            Value::Array(vec![Value::Array(vec![
                Value::BulkString(b"1700000000000-1".to_vec()),
                Value::Array(vec![
                    Value::BulkString(b"payload".to_vec()),
                    Value::BulkString(br#"{"jobId":"j1","argv":["snapshot"]}"#.to_vec()),
                    Value::BulkString(b"attempts".to_vec()),
                    Value::BulkString(b"3".to_vec()),
                ]),
            ])]),
        ]);

        let msg = parse_xautoclaim_reply(&reply)
            .expect("parse should succeed")
            .expect("message should exist");
        assert_eq!(msg.message_id.as_deref(), Some("1700000000000-1"));
        assert_eq!(msg.attempts, 3);
        assert_eq!(msg.payload, r#"{"jobId":"j1","argv":["snapshot"]}"#);
    }

    #[test]
    fn test_parse_xautoclaim_reply_requires_payload_field() {
        let reply = Value::Array(vec![
            Value::BulkString(b"0-0".to_vec()),
            Value::Array(vec![Value::Array(vec![
                Value::BulkString(b"1700000000000-2".to_vec()),
                Value::Array(vec![Value::BulkString(b"attempts".to_vec()), Value::Int(2)]),
            ])]),
        ]);
        assert!(parse_xautoclaim_reply(&reply).is_err());
    }

    #[test]
    #[ignore]
    fn integration_redis_backpressure_terminal_fail() {
        let _guard = integration_env_lock().lock().expect("env lock poisoned");
        let redis_url = match std::env::var("AGENT_BROWSER_REDIS_URL") {
            Ok(v) if !v.trim().is_empty() => v,
            _ => {
                eprintln!("Skipping redis integration test; AGENT_BROWSER_REDIS_URL not set");
                return;
            }
        };

        let prefix = integration_prefix("redis");
        let stream = format!("{}:stream", prefix);
        let failed_stream = format!("{}:failed", prefix);
        let previous = set_env_vars(&[
            ("AGENT_BROWSER_REDIS_URL", redis_url),
            ("AGENT_BROWSER_REDIS_STREAM", stream.clone()),
            ("AGENT_BROWSER_REDIS_GROUP", format!("{}:group", prefix)),
            (
                "AGENT_BROWSER_REDIS_CONSUMER",
                format!("{}:consumer", prefix),
            ),
            ("AGENT_BROWSER_REDIS_FAILED_STREAM", failed_stream.clone()),
            ("AGENT_BROWSER_REDIS_MAX_ATTEMPTS", "5".to_string()),
        ]);

        let result = (|| -> Result<(), String> {
            let mut queue = RedisStreamsQueue::new_from_env()?;
            let add_id: String = redis::cmd("XADD")
                .arg(&stream)
                .arg("*")
                .arg("payload")
                .arg(r#"{"jobId":"redis-it","argv":["snapshot"]}"#)
                .query(&mut queue.conn)
                .map_err(|e| format!("Redis XADD setup failed: {}", e))?;
            let message = queue.recv()?.expect("message should exist");
            assert_eq!(
                message.payload,
                r#"{"jobId":"redis-it","argv":["snapshot"]}"#
            );
            queue.terminal_fail(&message, "governance: tenant hard-cap")?;

            let failed_entries: redis::Value = redis::cmd("XRANGE")
                .arg(&failed_stream)
                .arg("-")
                .arg("+")
                .query(&mut queue.conn)
                .map_err(|e| format!("Redis XRANGE failed: {}", e))?;
            let failed_text = format!("{:?}", failed_entries);
            assert!(
                failed_text.contains("tenant hard-cap"),
                "failed stream should contain terminal error, got: {}",
                failed_text
            );

            let pending: redis::Value = redis::cmd("XPENDING")
                .arg(&stream)
                .arg(&queue.group)
                .query(&mut queue.conn)
                .map_err(|e| format!("Redis XPENDING failed: {}", e))?;
            let pending_text = format!("{:?}", pending);
            assert!(
                !pending_text.contains(&add_id),
                "message should be acked after terminal_fail, got: {}",
                pending_text
            );
            Ok(())
        })();

        restore_env_vars(previous);
        result.expect("redis integration test should succeed");
    }

    #[test]
    #[ignore]
    fn integration_postgres_backpressure_terminal_fail() {
        let _guard = integration_env_lock().lock().expect("env lock poisoned");
        let dsn = match std::env::var("AGENT_BROWSER_PG_QUEUE_DSN") {
            Ok(v) if !v.trim().is_empty() => v,
            _ => {
                eprintln!("Skipping postgres integration test; AGENT_BROWSER_PG_QUEUE_DSN not set");
                return;
            }
        };

        let table = integration_prefix("pg").replace('-', "_");
        let previous = set_env_vars(&[
            ("AGENT_BROWSER_PG_QUEUE_DSN", dsn),
            ("AGENT_BROWSER_PG_QUEUE_TABLE", table.clone()),
            (
                "AGENT_BROWSER_PG_QUEUE_CONSUMER",
                format!("{}-consumer", table),
            ),
        ]);

        let result = (|| -> Result<(), String> {
            let mut queue = PostgresQueue::new_from_env()?;
            let insert_sql = format!("INSERT INTO {} (payload) VALUES ($1)", table);
            queue
                .client
                .execute(&insert_sql, &[&r#"{"jobId":"pg-it","argv":["snapshot"]}"#])
                .map_err(|e| format!("Postgres insert failed: {}", e))?;

            let message = queue.recv()?.expect("message should exist");
            let id = message.message_id.clone().expect("message id should exist");
            queue.terminal_fail(&message, "governance: tenant hard-cap")?;

            let status_sql = format!(
                "SELECT status, last_error FROM {} WHERE id::text = $1",
                table
            );
            let row = queue
                .client
                .query_one(&status_sql, &[&id])
                .map_err(|e| format!("Postgres select failed: {}", e))?;
            let status: String = row.get(0);
            let last_error: Option<String> = row.get(1);
            assert_eq!(status, "failed");
            assert!(
                last_error
                    .as_deref()
                    .unwrap_or_default()
                    .contains("tenant hard-cap"),
                "last_error should capture terminal fail"
            );
            Ok(())
        })();

        restore_env_vars(previous);
        result.expect("postgres integration test should succeed");
    }

    #[test]
    #[ignore]
    fn integration_nats_backpressure_terminal_fail() {
        let _guard = integration_env_lock().lock().expect("env lock poisoned");
        let nats_url = match std::env::var("AGENT_BROWSER_NATS_URL") {
            Ok(v) if !v.trim().is_empty() => v,
            _ => {
                eprintln!("Skipping nats integration test; AGENT_BROWSER_NATS_URL not set");
                return;
            }
        };

        let prefix = integration_prefix("nats");
        let stream = prefix.clone();
        let subject = format!("{}.jobs", prefix);
        let failed_subject = format!("{}.failed", prefix);
        let previous = set_env_vars(&[
            ("AGENT_BROWSER_NATS_URL", nats_url),
            ("AGENT_BROWSER_NATS_STREAM", stream.clone()),
            ("AGENT_BROWSER_NATS_SUBJECT", subject.clone()),
            (
                "AGENT_BROWSER_NATS_CONSUMER",
                format!("{}-consumer", prefix),
            ),
            ("AGENT_BROWSER_NATS_FAILED_SUBJECT", failed_subject.clone()),
            ("AGENT_BROWSER_NATS_MAX_ATTEMPTS", "5".to_string()),
            ("AGENT_BROWSER_NATS_FETCH_TIMEOUT_MS", "1000".to_string()),
        ]);

        let result = (|| -> Result<(), String> {
            let mut queue = NatsJetStreamQueue::new_from_env()?;
            queue
                .rt
                .block_on(async {
                    queue
                        .client
                        .publish(
                            subject.clone(),
                            r#"{"jobId":"nats-it","argv":["snapshot"]}"#.into(),
                        )
                        .await
                })
                .map_err(|e| format!("NATS publish failed: {}", e))?;
            std::thread::sleep(Duration::from_millis(300));

            let message = queue.recv()?.expect("message should exist");
            queue.terminal_fail(&message, "governance: tenant hard-cap")?;

            let got_failed = queue
                .rt
                .block_on(async {
                    let mut sub = queue
                        .client
                        .subscribe(failed_subject.clone())
                        .await
                        .map_err(|e| format!("NATS subscribe failed: {}", e))?;
                    tokio::time::timeout(Duration::from_secs(2), sub.next())
                        .await
                        .map_err(|_| "Timed out waiting for failed subject".to_string())
                })
                .map_err(|e| e.to_string())?;
            let msg = got_failed.ok_or_else(|| "Failed subject yielded no message".to_string())?;
            let body = String::from_utf8(msg.payload.to_vec())
                .map_err(|e| format!("Failed subject payload utf8 error: {}", e))?;
            assert!(body.contains("\"jobId\":\"nats-it\""));
            Ok(())
        })();

        restore_env_vars(previous);
        result.expect("nats integration test should succeed");
    }

    #[test]
    #[ignore]
    fn integration_sqs_backpressure_terminal_fail() {
        let _guard = integration_env_lock().lock().expect("env lock poisoned");
        let queue_url = match std::env::var("AGENT_BROWSER_SQS_QUEUE_URL") {
            Ok(v) if !v.trim().is_empty() => v,
            _ => {
                eprintln!("Skipping sqs integration test; AGENT_BROWSER_SQS_QUEUE_URL not set");
                return;
            }
        };
        let dlq_url = match std::env::var("AGENT_BROWSER_SQS_DLQ_URL") {
            Ok(v) if !v.trim().is_empty() => v,
            _ => {
                eprintln!("Skipping sqs integration test; AGENT_BROWSER_SQS_DLQ_URL not set");
                return;
            }
        };

        let previous = set_env_vars(&[
            ("AGENT_BROWSER_SQS_QUEUE_URL", queue_url.clone()),
            ("AGENT_BROWSER_SQS_DLQ_URL", dlq_url.clone()),
            ("AGENT_BROWSER_SQS_WAIT_SECONDS", "1".to_string()),
            ("AGENT_BROWSER_SQS_MAX_ATTEMPTS", "5".to_string()),
        ]);

        let result = (|| -> Result<(), String> {
            let mut queue = SqsQueue::new_from_env()?;
            let payload = format!(
                r#"{{"jobId":"{}","argv":["snapshot"]}}"#,
                integration_prefix("sqs-job")
            );
            queue
                .rt
                .block_on(async {
                    queue
                        .client
                        .send_message()
                        .queue_url(queue_url.clone())
                        .message_body(payload.clone())
                        .send()
                        .await
                })
                .map_err(|e| format!("SQS setup send_message failed: {}", e))?;

            let message = queue.recv()?.expect("message should exist");
            queue.terminal_fail(&message, "governance: tenant hard-cap")?;

            let dlq_resp = queue
                .rt
                .block_on(async {
                    queue
                        .client
                        .receive_message()
                        .queue_url(dlq_url.clone())
                        .max_number_of_messages(1)
                        .wait_time_seconds(2)
                        .message_attribute_names("All")
                        .send()
                        .await
                })
                .map_err(|e| format!("SQS DLQ receive_message failed: {}", e))?;
            let dlq_msg = dlq_resp
                .messages()
                .first()
                .ok_or_else(|| "DLQ should contain terminal-failed message".to_string())?;
            assert_eq!(dlq_msg.body(), Some(payload.as_str()));
            Ok(())
        })();

        restore_env_vars(previous);
        result.expect("sqs integration test should succeed");
    }
}
