mod color;
mod commands;
mod connection;
mod flags;
mod install;
mod native;
mod output;
mod queue;
#[cfg(test)]
mod test_utils;
mod validation;

use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::io::{self, Read};
use std::process::exit;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[cfg(windows)]
use windows_sys::Win32::Foundation::CloseHandle;
#[cfg(windows)]
use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};

use commands::{gen_id, parse_command, ParseError};
use connection::{
    daemon_health, ensure_daemon, get_socket_dir, send_command, send_command_with_timeout,
    DaemonOptions,
};
use flags::{clean_args, parse_flags};
use install::run_install;
use output::{
    print_command_help, print_help, print_response_with_opts, print_version, OutputOptions,
};

use std::path::PathBuf;
use std::process::Command as ProcessCommand;

/// Run a local auth command (auth_save/list/show/delete) via node auth-cli.js.
/// These commands don't need a browser, so we handle them directly to avoid
/// sending passwords through the daemon's Unix socket channel.
fn run_auth_cli(cmd: &serde_json::Value, json_mode: bool) -> ! {
    let exe_path = env::current_exe().unwrap_or_default();
    let exe_path = exe_path.canonicalize().unwrap_or(exe_path);
    #[cfg(windows)]
    let exe_path = {
        let p = exe_path.to_string_lossy();
        if let Some(stripped) = p.strip_prefix(r"\\?\") {
            PathBuf::from(stripped)
        } else {
            exe_path
        }
    };
    let exe_dir = exe_path.parent().unwrap_or(std::path::Path::new("."));

    let mut script_paths = vec![
        exe_dir.join("auth-cli.js"),
        exe_dir.join("../dist/auth-cli.js"),
        PathBuf::from("dist/auth-cli.js"),
    ];

    if let Ok(home) = env::var("AGENT_BROWSER_HOME") {
        let home_path = PathBuf::from(&home);
        script_paths.insert(0, home_path.join("dist/auth-cli.js"));
        script_paths.insert(1, home_path.join("auth-cli.js"));
    }

    let script_path = match script_paths.iter().find(|p| p.exists()) {
        Some(p) => p.clone(),
        None => {
            if json_mode {
                println!(r#"{{"success":false,"error":"auth-cli.js not found"}}"#);
            } else {
                eprintln!(
                    "{} auth-cli.js not found. Set AGENT_BROWSER_HOME or run from project directory.",
                    color::error_indicator()
                );
            }
            exit(1);
        }
    };

    let cmd_json = serde_json::to_string(cmd).unwrap_or_default();

    match ProcessCommand::new("node")
        .arg(&script_path)
        .arg(&cmd_json)
        .output()
    {
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if !stderr.is_empty() {
                eprint!("{}", stderr);
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            let stdout = stdout.trim();

            if stdout.is_empty() {
                if json_mode {
                    println!(r#"{{"success":false,"error":"No response from auth-cli"}}"#);
                } else {
                    eprintln!("{} No response from auth-cli", color::error_indicator());
                }
                exit(1);
            }

            if json_mode {
                println!("{}", stdout);
            } else {
                // Parse the JSON response and use the standard output formatter
                match serde_json::from_str::<connection::Response>(stdout) {
                    Ok(resp) => {
                        let action = cmd.get("action").and_then(|v| v.as_str());
                        let opts = OutputOptions {
                            json: false,
                            content_boundaries: false,
                            max_output: None,
                        };
                        print_response_with_opts(&resp, action, &opts);
                        if !resp.success {
                            exit(1);
                        }
                    }
                    Err(_) => {
                        println!("{}", stdout);
                    }
                }
            }
            exit(output.status.code().unwrap_or(0));
        }
        Err(e) => {
            if json_mode {
                println!(
                    r#"{{"success":false,"error":"Failed to run auth-cli: {}"}}"#,
                    e
                );
            } else {
                eprintln!("{} Failed to run auth-cli: {}", color::error_indicator(), e);
            }
            exit(1);
        }
    }
}

fn parse_proxy(proxy_str: &str) -> serde_json::Value {
    let Some(protocol_end) = proxy_str.find("://") else {
        return json!({ "server": proxy_str });
    };
    let protocol = &proxy_str[..protocol_end + 3];
    let rest = &proxy_str[protocol_end + 3..];

    let Some(at_pos) = rest.rfind('@') else {
        return json!({ "server": proxy_str });
    };

    let creds = &rest[..at_pos];
    let server_part = &rest[at_pos + 1..];
    let server = format!("{}{}", protocol, server_part);

    let Some(colon_pos) = creds.find(':') else {
        return json!({
            "server": server,
            "username": creds,
            "password": ""
        });
    };

    json!({
        "server": server,
        "username": &creds[..colon_pos],
        "password": &creds[colon_pos + 1..]
    })
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum AffinityScope {
    Context,
    Session,
}

impl AffinityScope {
    fn as_str(self) -> &'static str {
        match self {
            AffinityScope::Context => "context",
            AffinityScope::Session => "session",
        }
    }

    fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "context" => Some(AffinityScope::Context),
            "session" => Some(AffinityScope::Session),
            _ => None,
        }
    }
}

#[derive(Default)]
struct JobRequest {
    job_id: Option<String>,
    session: Option<String>,
    affinity_key: Option<String>,
    affinity_scope: Option<AffinityScope>,
    tenant_id: Option<String>,
    workflow_id: Option<String>,
    context_id: Option<String>,
    budget_cost: Option<u64>,
    command: Option<serde_json::Value>,
    argv: Option<Vec<String>>,
}

impl JobRequest {
    fn affinity_key(&self, default_scope: AffinityScope) -> Option<String> {
        if let Some(v) = self
            .affinity_key
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            return Some(v.to_string());
        }

        let scope = self.affinity_scope.unwrap_or(default_scope);
        let tenant = self
            .tenant_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());
        let workflow = self
            .workflow_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());
        let context = self
            .context_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());

        match scope {
            AffinityScope::Context => match (tenant, workflow, context) {
                (Some(t), Some(w), Some(c)) => {
                    Some(format!("tenant:{}|workflow:{}|context:{}", t, w, c))
                }
                (Some(t), Some(w), None) => Some(format!("tenant:{}|workflow:{}", t, w)),
                (Some(t), None, Some(c)) => Some(format!("tenant:{}|context:{}", t, c)),
                (None, Some(w), Some(c)) => Some(format!("workflow:{}|context:{}", w, c)),
                (Some(t), None, None) => Some(format!("tenant:{}", t)),
                (None, Some(w), None) => Some(format!("workflow:{}", w)),
                (None, None, Some(c)) => Some(format!("context:{}", c)),
                (None, None, None) => None,
            },
            AffinityScope::Session => match (tenant, workflow, context) {
                (Some(t), Some(w), _) => Some(format!("tenant:{}|workflow:{}", t, w)),
                (Some(t), None, _) => Some(format!("tenant:{}", t)),
                (None, Some(w), _) => Some(format!("workflow:{}", w)),
                (None, None, Some(c)) => Some(format!("context:{}", c)),
                (None, None, None) => None,
            },
        }
    }
}

#[derive(Clone, Debug)]
struct WorkerGovernanceConfig {
    tenant_job_budget: u64,
    tenant_failure_budget: u64,
    domain_min_interval_ms: u64,
    job_timeout_ms: u64,
}

impl WorkerGovernanceConfig {
    fn from_env() -> Self {
        let tenant_job_budget = env::var("AGENT_BROWSER_TENANT_BUDGET_MAX_JOBS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(0);
        let tenant_failure_budget = env::var("AGENT_BROWSER_TENANT_BUDGET_MAX_FAILURES")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(0);
        let domain_min_interval_ms = env::var("AGENT_BROWSER_DOMAIN_MIN_INTERVAL_MS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(0);
        let job_timeout_ms = env::var("AGENT_BROWSER_JOB_TIMEOUT_MS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(0);
        Self {
            tenant_job_budget,
            tenant_failure_budget,
            domain_min_interval_ms,
            job_timeout_ms,
        }
    }
}

#[derive(Clone, Debug, Default)]
struct TenantBudgetState {
    jobs: u64,
    failures: u64,
    blocked: u64,
    terminal_failed: u64,
    last_reason_code: Option<String>,
}

struct WorkerGovernance {
    config: WorkerGovernanceConfig,
    tenants: HashMap<String, TenantBudgetState>,
    domains: HashMap<String, u128>,
    blocked_total: u64,
    terminal_failed_total: u64,
    last_reason_code: Option<String>,
}

#[derive(Clone, Debug)]
struct GovernanceRejection {
    code: &'static str,
    message: String,
    tenant: Option<String>,
    domain: Option<String>,
    retry_after_ms: Option<u64>,
    hard_cap: bool,
}

impl WorkerGovernance {
    fn new() -> Self {
        Self {
            config: WorkerGovernanceConfig::from_env(),
            tenants: HashMap::new(),
            domains: HashMap::new(),
            blocked_total: 0,
            terminal_failed_total: 0,
            last_reason_code: None,
        }
    }

    fn admit(&mut self, job: &JobRequest) -> Result<(), GovernanceRejection> {
        if let Some(tenant) = job
            .tenant_id
            .as_deref()
            .map(str::trim)
            .filter(|t| !t.is_empty())
        {
            let state = self.tenants.entry(tenant.to_string()).or_default();
            if self.config.tenant_job_budget > 0 && state.jobs >= self.config.tenant_job_budget {
                return Err(GovernanceRejection {
                    code: "tenant_job_budget_exceeded",
                    message: format!(
                        "governance: tenant '{}' job budget exceeded (max {})",
                        tenant, self.config.tenant_job_budget
                    ),
                    tenant: Some(tenant.to_string()),
                    domain: None,
                    retry_after_ms: None,
                    hard_cap: true,
                });
            }
            if self.config.tenant_failure_budget > 0
                && state.failures >= self.config.tenant_failure_budget
            {
                return Err(GovernanceRejection {
                    code: "tenant_failure_budget_exceeded",
                    message: format!(
                        "governance: tenant '{}' failure budget exceeded (max {})",
                        tenant, self.config.tenant_failure_budget
                    ),
                    tenant: Some(tenant.to_string()),
                    domain: None,
                    retry_after_ms: None,
                    hard_cap: true,
                });
            }
        }

        if self.config.domain_min_interval_ms > 0 {
            if let Some(domain) = extract_job_domain(job) {
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|d| d.as_millis())
                    .unwrap_or(0);
                if let Some(last) = self.domains.get(&domain) {
                    let elapsed = now.saturating_sub(*last);
                    if elapsed < self.config.domain_min_interval_ms as u128 {
                        let retry_after = self.config.domain_min_interval_ms as u128 - elapsed;
                        return Err(GovernanceRejection {
                            code: "domain_rate_limited",
                            message: format!(
                                "governance: domain '{}' rate-limited, retry_after_ms={}",
                                domain, retry_after
                            ),
                            tenant: None,
                            domain: Some(domain),
                            retry_after_ms: Some(retry_after as u64),
                            hard_cap: false,
                        });
                    }
                }
                self.domains.insert(domain, now);
            }
        }

        Ok(())
    }

    fn record_result(&mut self, job: &JobRequest, success: bool) {
        if let Some(tenant) = job
            .tenant_id
            .as_deref()
            .map(str::trim)
            .filter(|t| !t.is_empty())
        {
            let state = self.tenants.entry(tenant.to_string()).or_default();
            state.jobs = state.jobs.saturating_add(job.budget_cost.unwrap_or(1));
            if !success {
                state.failures = state.failures.saturating_add(1);
            }
        }
    }

    fn record_backpressure(
        &mut self,
        job: &JobRequest,
        rejection: &GovernanceRejection,
        terminal_failed: bool,
    ) {
        self.blocked_total = self.blocked_total.saturating_add(1);
        if terminal_failed {
            self.terminal_failed_total = self.terminal_failed_total.saturating_add(1);
        }
        self.last_reason_code = Some(rejection.code.to_string());

        let tenant = rejection.tenant.as_deref().or_else(|| {
            job.tenant_id
                .as_deref()
                .map(str::trim)
                .filter(|t| !t.is_empty())
        });
        if let Some(tenant) = tenant {
            let state = self.tenants.entry(tenant.to_string()).or_default();
            state.blocked = state.blocked.saturating_add(1);
            if terminal_failed {
                state.terminal_failed = state.terminal_failed.saturating_add(1);
            }
            state.last_reason_code = Some(rejection.code.to_string());
        }
    }

    fn snapshot(&self) -> serde_json::Value {
        let tenants: Vec<serde_json::Value> = self
            .tenants
            .iter()
            .map(|(tenant, state)| {
                json!({
                    "tenant": tenant,
                    "jobs": state.jobs,
                    "failures": state.failures,
                    "blocked": state.blocked,
                    "terminalFailed": state.terminal_failed,
                    "lastReasonCode": state.last_reason_code,
                })
            })
            .collect();
        json!({
            "tenantJobBudget": self.config.tenant_job_budget,
            "tenantFailureBudget": self.config.tenant_failure_budget,
            "domainMinIntervalMs": self.config.domain_min_interval_ms,
            "jobTimeoutMs": self.config.job_timeout_ms,
            "blockedTotal": self.blocked_total,
            "terminalFailedTotal": self.terminal_failed_total,
            "lastReasonCode": self.last_reason_code,
            "tenants": tenants,
            "trackedDomains": self.domains.len(),
        })
    }
}

#[derive(Clone, Debug)]
struct WorkerPoolConfig {
    max_contexts_per_worker: usize,
    max_pages_per_worker: usize,
    recycle_min_score: i32,
    recycle_after_jobs: u64,
    page_probe_every_jobs: u64,
    affinity_ttl_jobs: u64,
    affinity_strategy: AffinityStrategy,
    affinity_scope: AffinityScope,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum AffinityStrategy {
    Sticky,
    None,
}

impl AffinityStrategy {
    fn as_str(self) -> &'static str {
        match self {
            AffinityStrategy::Sticky => "sticky",
            AffinityStrategy::None => "none",
        }
    }
}

impl WorkerPoolConfig {
    fn from_env() -> Self {
        let max_contexts_per_worker = env::var("AGENT_BROWSER_POOL_MAX_CONTEXTS")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(1);
        let max_pages_per_worker = env::var("AGENT_BROWSER_POOL_MAX_PAGES")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(0);
        let recycle_min_score = env::var("AGENT_BROWSER_POOL_RECYCLE_MIN_SCORE")
            .ok()
            .and_then(|v| v.parse::<i32>().ok())
            .unwrap_or(40)
            .clamp(0, 100);
        let recycle_after_jobs = env::var("AGENT_BROWSER_POOL_RECYCLE_AFTER_JOBS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(200);
        let page_probe_every_jobs = env::var("AGENT_BROWSER_POOL_PAGE_PROBE_EVERY")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(5);
        let affinity_ttl_jobs = env::var("AGENT_BROWSER_POOL_AFFINITY_TTL_JOBS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(1000);
        let affinity_strategy = env::var("AGENT_BROWSER_POOL_AFFINITY_STRATEGY")
            .ok()
            .map(|v| v.trim().to_ascii_lowercase())
            .and_then(|v| match v.as_str() {
                "sticky" => Some(AffinityStrategy::Sticky),
                "none" => Some(AffinityStrategy::None),
                _ => None,
            })
            .unwrap_or(AffinityStrategy::Sticky);
        let affinity_scope = env::var("AGENT_BROWSER_POOL_AFFINITY_SCOPE")
            .ok()
            .and_then(|v| AffinityScope::parse(&v))
            .unwrap_or(AffinityScope::Context);
        Self {
            max_contexts_per_worker,
            max_pages_per_worker,
            recycle_min_score,
            recycle_after_jobs,
            page_probe_every_jobs,
            affinity_ttl_jobs,
            affinity_strategy,
            affinity_scope,
        }
    }
}

#[derive(Clone, Debug)]
struct WorkerSessionState {
    health_score: i32,
    jobs_processed: u64,
    failures: u64,
    last_page_count: usize,
}

impl WorkerSessionState {
    fn new() -> Self {
        Self {
            health_score: 100,
            jobs_processed: 0,
            failures: 0,
            last_page_count: 0,
        }
    }
}

struct WorkerBrowserPool {
    config: WorkerPoolConfig,
    default_session: String,
    next_dynamic_id: u64,
    observed_jobs: u64,
    affinities: HashMap<String, AffinityBinding>,
    sessions: HashMap<String, WorkerSessionState>,
    affinity_hits: u64,
    affinity_misses: u64,
}

#[derive(Clone, Debug)]
struct AffinityBinding {
    session: String,
    last_seen_job: u64,
}

#[derive(Clone, Debug)]
struct RecycleDecision {
    session: String,
    reasons: Vec<String>,
}

impl WorkerBrowserPool {
    fn new(default_session: &str) -> Self {
        let config = WorkerPoolConfig::from_env();
        let mut sessions = HashMap::new();
        sessions.insert(default_session.to_string(), WorkerSessionState::new());
        Self {
            config,
            default_session: default_session.to_string(),
            next_dynamic_id: 1,
            observed_jobs: 0,
            affinities: HashMap::new(),
            sessions,
            affinity_hits: 0,
            affinity_misses: 0,
        }
    }

    fn pick_session_for_job(
        &mut self,
        requested: Option<&str>,
        affinity_key: Option<&str>,
    ) -> (String, Option<String>, bool) {
        self.observed_jobs = self.observed_jobs.saturating_add(1);
        if self.config.affinity_strategy == AffinityStrategy::Sticky {
            self.prune_affinity_bindings();
        } else {
            self.affinities.clear();
        }

        if let Some(session) = requested.filter(|s| !s.trim().is_empty()) {
            self.ensure_session(session);
            let session = session.to_string();
            if self.config.affinity_strategy == AffinityStrategy::Sticky {
                if let Some(key) = affinity_key.map(str::trim).filter(|k| !k.is_empty()) {
                    self.affinities.insert(
                        key.to_string(),
                        AffinityBinding {
                            session: session.clone(),
                            last_seen_job: self.observed_jobs,
                        },
                    );
                    self.affinity_misses = self.affinity_misses.saturating_add(1);
                    return (session, Some(key.to_string()), false);
                }
                return (session, None, false);
            }
            if let Some(key) = affinity_key.map(str::trim).filter(|k| !k.is_empty()) {
                self.affinity_misses = self.affinity_misses.saturating_add(1);
                return (session, Some(key.to_string()), false);
            }
            return (session, None, false);
        }

        if self.config.affinity_strategy != AffinityStrategy::Sticky {
            let chosen = self.choose_session_without_affinity();
            if let Some(key) = affinity_key.map(str::trim).filter(|k| !k.is_empty()) {
                self.affinity_misses = self.affinity_misses.saturating_add(1);
                return (chosen, Some(key.to_string()), false);
            }
            return (chosen, None, false);
        }

        if let Some(key) = affinity_key.map(str::trim).filter(|k| !k.is_empty()) {
            if let Some(binding) = self.affinities.get_mut(key) {
                if self.sessions.contains_key(&binding.session) {
                    binding.last_seen_job = self.observed_jobs;
                    self.affinity_hits = self.affinity_hits.saturating_add(1);
                    return (binding.session.clone(), Some(key.to_string()), true);
                }
            }
            let chosen = self.choose_session_without_affinity();
            self.affinities.insert(
                key.to_string(),
                AffinityBinding {
                    session: chosen.clone(),
                    last_seen_job: self.observed_jobs,
                },
            );
            self.affinity_misses = self.affinity_misses.saturating_add(1);
            return (chosen, Some(key.to_string()), false);
        }

        (self.choose_session_without_affinity(), None, false)
    }

    fn choose_session_without_affinity(&mut self) -> String {
        if self.config.max_contexts_per_worker <= 1 {
            let session = self.default_session.clone();
            self.ensure_session(&session);
            return session;
        }

        if self.sessions.len() < self.config.max_contexts_per_worker {
            let session = format!("{}-ctx-{}", self.default_session, self.next_dynamic_id);
            self.next_dynamic_id = self.next_dynamic_id.saturating_add(1);
            self.ensure_session(&session);
            return session;
        }

        self.sessions
            .iter()
            .max_by(|(_, a), (_, b)| {
                a.health_score
                    .cmp(&b.health_score)
                    .then_with(|| b.failures.cmp(&a.failures))
                    .then_with(|| b.jobs_processed.cmp(&a.jobs_processed))
            })
            .map(|(s, _)| s.clone())
            .unwrap_or_else(|| self.default_session.clone())
    }

    fn prune_affinity_bindings(&mut self) {
        let ttl = self.config.affinity_ttl_jobs;
        let now = self.observed_jobs;
        let existing_sessions: HashSet<String> = self.sessions.keys().cloned().collect();
        self.affinities.retain(|_, binding| {
            if !existing_sessions.contains(&binding.session) {
                return false;
            }
            if ttl == 0 {
                return true;
            }
            now.saturating_sub(binding.last_seen_job) <= ttl
        });
    }

    fn ensure_session(&mut self, session: &str) {
        self.sessions
            .entry(session.to_string())
            .or_insert_with(WorkerSessionState::new);
    }

    fn observe_result(
        &mut self,
        session: &str,
        affinity_key: Option<&str>,
        success: bool,
        error_text: Option<&str>,
        page_count: Option<usize>,
    ) -> Vec<RecycleDecision> {
        self.ensure_session(session);
        if let Some(state) = self.sessions.get_mut(session) {
            state.jobs_processed = state.jobs_processed.saturating_add(1);
            if success {
                state.health_score = (state.health_score + 3).min(100);
            } else {
                state.failures = state.failures.saturating_add(1);
                state.health_score = (state.health_score - 20).max(0);
                if error_text
                    .map(|e| {
                        let lower = e.to_ascii_lowercase();
                        lower.contains("timeout")
                            || lower.contains("connection")
                            || lower.contains("socket")
                            || lower.contains("broken pipe")
                    })
                    .unwrap_or(false)
                {
                    state.health_score = (state.health_score - 10).max(0);
                }
            }
            if let Some(count) = page_count {
                state.last_page_count = count;
            }
        }

        let mut recycle: Vec<RecycleDecision> = Vec::new();
        let mut recycle_map: HashMap<String, Vec<String>> = HashMap::new();
        for (name, state) in &self.sessions {
            let mut reasons: Vec<String> = Vec::new();
            if state.jobs_processed >= self.config.recycle_after_jobs {
                reasons.push("max_jobs".to_string());
            }
            if state.health_score <= self.config.recycle_min_score {
                reasons.push("low_health".to_string());
            }
            if !reasons.is_empty() {
                recycle_map.insert(name.clone(), reasons);
            }
        }

        if self.config.max_pages_per_worker > 0 {
            let mut total_pages = self.total_pages();
            if total_pages > self.config.max_pages_per_worker {
                let mut by_pages: Vec<(String, usize)> = self
                    .sessions
                    .iter()
                    .map(|(name, state)| (name.clone(), state.last_page_count))
                    .collect();
                by_pages.sort_by(|a, b| b.1.cmp(&a.1));
                for (candidate, pages) in by_pages {
                    if total_pages <= self.config.max_pages_per_worker {
                        break;
                    }
                    if pages == 0 {
                        continue;
                    }
                    if let Some(reasons) = recycle_map.get_mut(&candidate) {
                        if !reasons.iter().any(|r| r == "max_pages") {
                            reasons.push("max_pages".to_string());
                        }
                    } else {
                        recycle_map.insert(candidate.clone(), vec!["max_pages".to_string()]);
                    }
                    total_pages = total_pages.saturating_sub(pages);
                }
            }
        }

        for (session_name, reasons) in &recycle_map {
            self.sessions.remove(session_name);
            recycle.push(RecycleDecision {
                session: session_name.clone(),
                reasons: reasons.clone(),
            });
        }
        let existing_sessions: HashSet<String> = self.sessions.keys().cloned().collect();
        let ttl = self.config.affinity_ttl_jobs;
        let now = self.observed_jobs;
        if self.config.affinity_strategy == AffinityStrategy::Sticky {
            self.affinities.retain(|_, binding| {
                existing_sessions.contains(&binding.session)
                    && (ttl == 0 || now.saturating_sub(binding.last_seen_job) <= ttl)
            });
            if let Some(key) = affinity_key.map(str::trim).filter(|k| !k.is_empty()) {
                if let Some(binding) = self.affinities.get_mut(key) {
                    binding.last_seen_job = self.observed_jobs;
                }
            }
        } else {
            self.affinities.clear();
        }
        if self.sessions.is_empty() {
            self.sessions
                .insert(self.default_session.clone(), WorkerSessionState::new());
        }

        recycle
    }

    fn should_probe_pages(&self, session: &str) -> bool {
        if self.config.max_pages_per_worker == 0 {
            return false;
        }
        let Some(state) = self.sessions.get(session) else {
            return true;
        };
        state.jobs_processed == 0
            || state.jobs_processed % self.config.page_probe_every_jobs == 0
            || state.jobs_processed >= self.config.recycle_after_jobs
            || state.health_score <= self.config.recycle_min_score
    }

    fn total_pages(&self) -> usize {
        self.sessions.values().map(|s| s.last_page_count).sum()
    }

    fn state_for_session(&self, session: &str) -> Option<&WorkerSessionState> {
        self.sessions.get(session)
    }

    fn affinity_count(&self) -> usize {
        self.affinities.len()
    }

    fn affinity_metrics(&self) -> (u64, u64) {
        (self.affinity_hits, self.affinity_misses)
    }

    fn observed_jobs(&self) -> u64 {
        self.observed_jobs
    }
}

fn close_session_browser(session: &str) -> Result<(), String> {
    let close_cmd = json!({
        "id": gen_id(),
        "action": "close",
    });
    send_command(close_cmd, session).map(|_| ())
}

fn extract_tab_count(data: Option<&serde_json::Value>) -> Option<usize> {
    let data = data?;
    if let Some(arr) = data.as_array() {
        return Some(arr.len());
    }
    data.get("tabs")
        .and_then(|v| v.as_array())
        .map(|arr| arr.len())
        .or_else(|| {
            data.get("pages")
                .and_then(|v| v.as_array())
                .map(|arr| arr.len())
        })
}

fn fetch_session_page_count(session: &str) -> Result<Option<usize>, String> {
    let tab_cmd = json!({
        "id": gen_id(),
        "action": "tab_list",
    });
    let response = send_command(tab_cmd, session)?;
    if !response.success {
        return Ok(None);
    }
    Ok(extract_tab_count(response.data.as_ref()))
}

fn normalize_url_for_domain(raw: &str) -> String {
    if raw.contains("://") {
        raw.to_string()
    } else {
        format!("https://{}", raw)
    }
}

fn extract_domain_from_url(raw: &str) -> Option<String> {
    let normalized = normalize_url_for_domain(raw.trim());
    url::Url::parse(&normalized)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_string()))
}

fn extract_job_domain(job: &JobRequest) -> Option<String> {
    if let Some(cmd) = &job.command {
        let action = cmd.get("action").and_then(|v| v.as_str()).unwrap_or("");
        if matches!(action, "navigate" | "open" | "goto") {
            if let Some(url) = cmd
                .get("url")
                .and_then(|v| v.as_str())
                .or_else(|| cmd.get("target").and_then(|v| v.as_str()))
            {
                return extract_domain_from_url(url);
            }
        }
    }

    if let Some(argv) = &job.argv {
        if let Some(action) = argv.first().map(|s| s.as_str()) {
            if matches!(action, "open" | "goto" | "navigate") {
                if let Some(url) = argv.get(1) {
                    return extract_domain_from_url(url);
                }
            }
        }
    }

    None
}

fn get_worker_pool_stats_path(session: &str) -> PathBuf {
    if let Ok(path) = env::var("AGENT_BROWSER_POOL_STATS_PATH") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }
    get_socket_dir().join(format!("{}.pool-stats.json", session))
}

fn write_worker_pool_stats(
    stats_path: &PathBuf,
    queue_backend: &str,
    pool: &WorkerBrowserPool,
    governance: &WorkerGovernance,
) -> Result<(), String> {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let (affinity_hits, affinity_misses) = pool.affinity_metrics();
    let sessions: Vec<serde_json::Value> = pool
        .sessions
        .iter()
        .map(|(name, state)| {
            json!({
                "session": name,
                "healthScore": state.health_score,
                "jobsProcessed": state.jobs_processed,
                "failures": state.failures,
                "lastPageCount": state.last_page_count,
            })
        })
        .collect();
    let payload = json!({
        "updatedAtMs": now_ms,
        "queueBackend": queue_backend,
        "pool": {
            "observedJobs": pool.observed_jobs(),
            "contexts": pool.sessions.len(),
            "maxContexts": pool.config.max_contexts_per_worker,
            "totalPages": pool.total_pages(),
            "maxPages": pool.config.max_pages_per_worker,
            "affinities": pool.affinity_count(),
            "affinityHits": affinity_hits,
            "affinityMisses": affinity_misses,
            "affinityTtlJobs": pool.config.affinity_ttl_jobs,
            "affinityStrategy": pool.config.affinity_strategy.as_str(),
            "affinityScope": pool.config.affinity_scope.as_str(),
            "sessions": sessions,
        },
        "governance": governance.snapshot(),
    });
    if let Some(parent) = stats_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(
        stats_path,
        serde_json::to_vec_pretty(&payload).unwrap_or_default(),
    )
    .map_err(|e| format!("Failed to write worker pool stats: {}", e))
}

fn daemon_options_from_flags(flags: &flags::Flags) -> DaemonOptions<'_> {
    DaemonOptions {
        headed: flags.headed,
        debug: flags.debug,
        executable_path: flags.executable_path.as_deref(),
        extensions: &flags.extensions,
        args: flags.args.as_deref(),
        user_agent: flags.user_agent.as_deref(),
        proxy: flags.proxy.as_deref(),
        proxy_bypass: flags.proxy_bypass.as_deref(),
        ignore_https_errors: flags.ignore_https_errors,
        allow_file_access: flags.allow_file_access,
        profile: flags.profile.as_deref(),
        state: flags.state.as_deref(),
        provider: flags.provider.as_deref(),
        device: flags.device.as_deref(),
        session_name: flags.session_name.as_deref(),
        download_path: flags.download_path.as_deref(),
        allowed_domains: flags.allowed_domains.as_deref(),
        action_policy: flags.action_policy.as_deref(),
        confirm_actions: flags.confirm_actions.as_deref(),
        native: flags.native,
        engine: flags.engine.as_deref(),
    }
}

fn parse_job_request(input: &str) -> Result<JobRequest, String> {
    let raw: serde_json::Value =
        serde_json::from_str(input).map_err(|e| format!("Invalid job JSON: {}", e))?;
    let obj = raw
        .as_object()
        .ok_or_else(|| "Job JSON must be an object".to_string())?;

    let command = if let Some(cmd) = obj.get("command") {
        if !cmd.is_object() {
            return Err("'command' must be a JSON object".to_string());
        }
        Some(cmd.clone())
    } else if obj.get("action").is_some() {
        Some(raw.clone())
    } else {
        None
    };

    let argv = if let Some(argv_val) = obj.get("argv") {
        let arr = argv_val
            .as_array()
            .ok_or_else(|| "'argv' must be an array of strings".to_string())?;
        let mut out = Vec::with_capacity(arr.len());
        for v in arr {
            let s = v
                .as_str()
                .ok_or_else(|| "'argv' must contain only strings".to_string())?;
            out.push(s.to_string());
        }
        Some(out)
    } else {
        None
    };

    if command.is_none() && argv.is_none() {
        return Err(
            "Job JSON must include either 'command' (protocol object) or 'argv' (CLI args array)"
                .to_string(),
        );
    }

    let job_id = obj
        .get("job_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            obj.get("jobId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .or_else(|| {
            obj.get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        });

    let session = obj
        .get("session")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let affinity_key = obj
        .get("affinity_key")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            obj.get("affinityKey")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        });
    let affinity_scope = match obj
        .get("affinity_scope")
        .or_else(|| obj.get("affinityScope"))
    {
        Some(v) => {
            let raw = v
                .as_str()
                .ok_or_else(|| "'affinity_scope' must be a string when provided".to_string())?;
            Some(
                AffinityScope::parse(raw)
                    .ok_or_else(|| "'affinity_scope' must be 'session' or 'context'".to_string())?,
            )
        }
        None => None,
    };
    let tenant_id = obj
        .get("tenant_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            obj.get("tenantId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        });
    let workflow_id = obj
        .get("workflow_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            obj.get("workflowId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        });
    let context_id = obj
        .get("context_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            obj.get("contextId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        });
    let budget_cost = obj
        .get("budget_cost")
        .and_then(|v| v.as_u64())
        .or_else(|| obj.get("budgetCost").and_then(|v| v.as_u64()));

    Ok(JobRequest {
        job_id,
        session,
        affinity_key,
        affinity_scope,
        tenant_id,
        workflow_id,
        context_id,
        budget_cost,
        command,
        argv,
    })
}

fn execute_job_request(
    job: &JobRequest,
    flags: &flags::Flags,
    forced_session: Option<&str>,
    command_timeout_ms: Option<u64>,
) -> Result<(connection::Response, String, Option<String>, Option<String>), String> {
    let session = forced_session
        .filter(|s| !s.trim().is_empty())
        .or(job.session.as_deref())
        .unwrap_or(&flags.session)
        .to_string();
    let mut command = if let Some(cmd) = &job.command {
        cmd.clone()
    } else if let Some(argv) = &job.argv {
        parse_command(argv, flags)
            .map_err(|e| format!("Invalid job argv: {}", e.format().replace('\n', " ")))?
    } else {
        return Err("Job has neither command nor argv".to_string());
    };

    if command.get("id").and_then(|v| v.as_str()).is_none() {
        command["id"] = json!(gen_id());
    }

    let action = command
        .get("action")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let daemon_opts = daemon_options_from_flags(flags);
    ensure_daemon(&session, &daemon_opts)?;
    let response = send_command_with_timeout(command, &session, command_timeout_ms)?;
    Ok((response, session, action, job.job_id.clone()))
}

fn run_single_job_command(clean: &[String], flags: &flags::Flags) -> ! {
    let payload = match clean.get(1) {
        Some(v) if v == "-" => {
            let mut buf = String::new();
            if io::stdin().read_to_string(&mut buf).is_err() {
                println!(r#"{{"success":false,"error":"Failed to read job JSON from stdin"}}"#);
                exit(1);
            }
            buf
        }
        Some(v) => v.clone(),
        None => {
            println!(
                r#"{{"success":false,"error":"Missing job JSON","usage":"agent-browser run-job <job-json|->"}}"#
            );
            exit(1);
        }
    };

    let job = match parse_job_request(&payload) {
        Ok(j) => j,
        Err(e) => {
            println!(
                r#"{{"success":false,"error":"{}"}}"#,
                e.replace('"', "\\\"")
            );
            exit(1);
        }
    };

    match execute_job_request(&job, flags, None, None) {
        Ok((resp, _session, action, _job_id)) => {
            let output_opts = OutputOptions {
                json: flags.json,
                content_boundaries: flags.content_boundaries,
                max_output: flags.max_output,
            };
            print_response_with_opts(&resp, action.as_deref(), &output_opts);
            exit(if resp.success { 0 } else { 1 });
        }
        Err(e) => {
            println!(
                r#"{{"success":false,"error":"{}"}}"#,
                e.replace('"', "\\\"")
            );
            exit(1);
        }
    }
}

fn run_worker_command(clean: &[String], flags: &flags::Flags) -> ! {
    let queue_config = match queue::QueueConfig::from_worker_args(clean) {
        Ok(cfg) => cfg,
        Err(e) => {
            println!(
                r#"{{"success":false,"error":"{}"}}"#,
                e.replace('"', "\\\"")
            );
            exit(1);
        }
    };
    let mut job_queue = queue::create_queue(&queue_config);
    let error_backoff_ms = env::var("AGENT_BROWSER_QUEUE_ERROR_BACKOFF_MS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(1000);
    let max_consecutive_errors = env::var("AGENT_BROWSER_QUEUE_MAX_CONSECUTIVE_ERRORS")
        .ok()
        .and_then(|v| v.parse::<u32>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(30);
    let backpressure_sleep_ms = env::var("AGENT_BROWSER_QUEUE_BACKPRESSURE_SLEEP_MS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(1000);
    let mut consecutive_errors: u32 = 0;
    let mut pool = WorkerBrowserPool::new(&flags.session);
    let mut governance = WorkerGovernance::new();
    let stats_path = get_worker_pool_stats_path(&flags.session);

    loop {
        let message = match job_queue.recv() {
            Ok(Some(msg)) => msg,
            Ok(None) => {
                consecutive_errors = 0;
                if queue_config.backend == queue::QueueBackend::Stdin {
                    break;
                }
                continue;
            }
            Err(e) => {
                consecutive_errors = consecutive_errors.saturating_add(1);
                let should_exit = queue_config.backend == queue::QueueBackend::Stdin
                    || consecutive_errors >= max_consecutive_errors;
                let err_json = json!({
                    "success": false,
                    "error": e,
                    "queueBackend": queue_config.backend.as_str(),
                    "consecutiveQueueErrors": consecutive_errors,
                    "willExit": should_exit,
                });
                println!("{}", serde_json::to_string(&err_json).unwrap_or_default());
                if should_exit {
                    exit(1);
                }
                thread::sleep(Duration::from_millis(error_backoff_ms));
                continue;
            }
        };
        if message.payload.trim().is_empty() {
            continue;
        }
        consecutive_errors = 0;

        let mut used_session: Option<String> = None;
        let mut used_affinity: Option<String> = None;
        let mut admitted_job: Option<JobRequest> = None;
        let mut backpressure_event: Option<serde_json::Value> = None;
        let result = match parse_job_request(&message.payload) {
            Ok(job) => match governance.admit(&job) {
                Ok(()) => {
                    admitted_job = Some(job);
                    let job_ref = admitted_job.as_ref().expect("admitted job exists");
                    let derived_affinity = job_ref.affinity_key(pool.config.affinity_scope);
                    let (pooled_session, affinity_key, affinity_hit) = pool.pick_session_for_job(
                        job_ref.session.as_deref(),
                        derived_affinity.as_deref(),
                    );
                    used_session = Some(pooled_session.clone());
                    used_affinity = affinity_key.clone();
                    let command_timeout_ms = if governance.config.job_timeout_ms > 0 {
                        Some(governance.config.job_timeout_ms)
                    } else {
                        None
                    };
                    match execute_job_request(
                        job_ref,
                        flags,
                        Some(&pooled_session),
                        command_timeout_ms,
                    ) {
                        Ok((resp, session, action, job_id)) => json!({
                            "success": resp.success,
                            "jobId": job_id,
                            "session": session,
                            "action": action,
                            "queueBackend": queue_config.backend.as_str(),
                            "queueMessageId": message.message_id,
                            "pool": {
                                "maxContexts": pool.config.max_contexts_per_worker,
                                    "maxPages": pool.config.max_pages_per_worker,
                                    "affinityTtlJobs": pool.config.affinity_ttl_jobs,
                                    "affinityStrategy": pool.config.affinity_strategy.as_str(),
                                    "affinityScope": pool.config.affinity_scope.as_str(),
                                },
                            "affinity": {
                                "key": affinity_key,
                                "hit": affinity_hit,
                            },
                            "response": resp,
                        }),
                        Err(e) => json!({
                            "success": false,
                            "error": e,
                            "session": pooled_session,
                            "affinity": {
                                "key": affinity_key,
                                "hit": affinity_hit,
                            },
                            "queueBackend": queue_config.backend.as_str(),
                            "queueMessageId": message.message_id,
                        }),
                    }
                }
                Err(policy_error) => {
                    governance.record_backpressure(&job, &policy_error, policy_error.hard_cap);
                    let retry_after_ms = policy_error
                        .retry_after_ms
                        .unwrap_or(backpressure_sleep_ms)
                        .max(backpressure_sleep_ms);
                    backpressure_event = Some(json!({
                        "success": false,
                        "event": "queue_backpressure",
                        "reasonCode": policy_error.code,
                        "hardCap": policy_error.hard_cap,
                        "settleMode": if policy_error.hard_cap { "terminal_fail" } else { "nack" },
                        "tenant": policy_error.tenant,
                        "domain": policy_error.domain,
                        "retryAfterMs": retry_after_ms,
                        "queueBackend": queue_config.backend.as_str(),
                        "queueMessageId": message.message_id,
                        "governance": governance.snapshot(),
                    }));
                    json!({
                        "success": false,
                        "error": policy_error.message,
                        "reasonCode": policy_error.code,
                        "hardCap": policy_error.hard_cap,
                        "settleMode": if policy_error.hard_cap { "terminal_fail" } else { "nack" },
                        "retryAfterMs": retry_after_ms,
                        "governance": governance.snapshot(),
                        "queueBackend": queue_config.backend.as_str(),
                        "queueMessageId": message.message_id,
                    })
                }
            },
            Err(e) => json!({
                "success": false,
                "error": e,
                "queueBackend": queue_config.backend.as_str(),
                "queueMessageId": message.message_id,
            }),
        };

        let success = result
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let error_text = result
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("job execution failed");
        let hard_cap_backpressure = backpressure_event
            .as_ref()
            .and_then(|v| v.get("hardCap"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        if let Some(event) = backpressure_event.as_ref() {
            println!("{}", serde_json::to_string(event).unwrap_or_default());
        }
        println!("{}", serde_json::to_string(&result).unwrap_or_default());
        if !success {
            if let Some(event) = backpressure_event.as_ref() {
                let retry_after_ms = event
                    .get("retryAfterMs")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(backpressure_sleep_ms);
                thread::sleep(Duration::from_millis(retry_after_ms));
            }
        }
        let settle_result = if success {
            job_queue.ack(&message)
        } else if hard_cap_backpressure {
            job_queue.terminal_fail(&message, error_text)
        } else {
            job_queue.nack(&message, error_text)
        };
        if let Err(e) = settle_result {
            let settle_failure = json!({
                "success": false,
                "error": format!("Queue settle failed: {}", e),
                "queueBackend": queue_config.backend.as_str(),
                "queueMessageId": message.message_id,
            });
            println!(
                "{}",
                serde_json::to_string(&settle_failure).unwrap_or_default()
            );
            exit(1);
        }

        if let Some(job) = admitted_job.as_ref() {
            governance.record_result(job, success);
        }

        if let Some(session_name) = used_session {
            let page_count = if pool.should_probe_pages(&session_name) {
                match fetch_session_page_count(&session_name) {
                    Ok(count) => count,
                    Err(_) => None,
                }
            } else {
                None
            };

            let recycle_sessions = pool.observe_result(
                &session_name,
                used_affinity.as_deref(),
                success,
                Some(error_text),
                page_count,
            );
            for recycle in recycle_sessions {
                if let Err(err) = close_session_browser(&recycle.session) {
                    let recycle_warn = json!({
                        "success": false,
                        "error": format!("Pool recycle close failed: {}", err),
                        "session": recycle.session,
                        "reasons": recycle.reasons,
                        "queueBackend": queue_config.backend.as_str(),
                    });
                    println!(
                        "{}",
                        serde_json::to_string(&recycle_warn).unwrap_or_default()
                    );
                } else {
                    let recycle_event = json!({
                        "success": true,
                        "event": "session_recycled",
                        "session": recycle.session,
                        "reasons": recycle.reasons,
                        "queueBackend": queue_config.backend.as_str(),
                    });
                    println!(
                        "{}",
                        serde_json::to_string(&recycle_event).unwrap_or_default()
                    );
                }
            }

            if let Some(state) = pool.state_for_session(&session_name) {
                let (affinity_hits, affinity_misses) = pool.affinity_metrics();
                let health_event = json!({
                    "success": true,
                    "event": "pool_health",
                    "session": session_name,
                    "queueBackend": queue_config.backend.as_str(),
                    "pool": {
                        "healthScore": state.health_score,
                        "jobsProcessed": state.jobs_processed,
                        "failures": state.failures,
                        "lastPageCount": state.last_page_count,
                        "totalPages": pool.total_pages(),
                        "contexts": pool.sessions.len(),
                        "affinities": pool.affinity_count(),
                        "maxContexts": pool.config.max_contexts_per_worker,
                        "maxPages": pool.config.max_pages_per_worker,
                        "affinityTtlJobs": pool.config.affinity_ttl_jobs,
                        "affinityStrategy": pool.config.affinity_strategy.as_str(),
                        "affinityScope": pool.config.affinity_scope.as_str(),
                        "affinityHits": affinity_hits,
                        "affinityMisses": affinity_misses,
                    }
                });
                println!(
                    "{}",
                    serde_json::to_string(&health_event).unwrap_or_default()
                );
            }
            if let Err(err) = write_worker_pool_stats(
                &stats_path,
                queue_config.backend.as_str(),
                &pool,
                &governance,
            ) {
                let stats_warn = json!({
                    "success": false,
                    "error": err,
                    "queueBackend": queue_config.backend.as_str(),
                    "statsPath": stats_path,
                });
                println!("{}", serde_json::to_string(&stats_warn).unwrap_or_default());
            }
        }
    }

    exit(0);
}

fn run_health_command(flags: &flags::Flags) -> ! {
    let health = daemon_health(&flags.session);
    let queue_backend = env::var("AGENT_BROWSER_QUEUE_BACKEND")
        .ok()
        .and_then(|v| queue::QueueBackend::parse(&v))
        .unwrap_or(queue::QueueBackend::Stdin);
    let pool_config = WorkerPoolConfig::from_env();
    let governance_config = WorkerGovernanceConfig::from_env();
    let queue_backpressure_sleep_ms = env::var("AGENT_BROWSER_QUEUE_BACKPRESSURE_SLEEP_MS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(1000);

    if flags.json {
        println!(
            "{}",
            json!({
                "success": health.responsive,
                "data": {
                    "session": flags.session,
                    "running": health.running,
                    "responsive": health.responsive,
                    "endpoint": health.endpoint,
                    "queueBackend": queue_backend.as_str(),
                    "queueBackpressureSleepMs": queue_backpressure_sleep_ms,
                    "pool": {
                        "maxContexts": pool_config.max_contexts_per_worker,
                        "maxPages": pool_config.max_pages_per_worker,
                        "recycleMinScore": pool_config.recycle_min_score,
                        "recycleAfterJobs": pool_config.recycle_after_jobs,
                        "pageProbeEveryJobs": pool_config.page_probe_every_jobs,
                        "affinityTtlJobs": pool_config.affinity_ttl_jobs,
                        "affinityStrategy": pool_config.affinity_strategy.as_str(),
                        "affinityScope": pool_config.affinity_scope.as_str(),
                    },
                    "governance": {
                        "tenantJobBudget": governance_config.tenant_job_budget,
                        "tenantFailureBudget": governance_config.tenant_failure_budget,
                        "domainMinIntervalMs": governance_config.domain_min_interval_ms,
                        "jobTimeoutMs": governance_config.job_timeout_ms,
                    }
                }
            })
        );
    } else {
        println!("Session: {}", flags.session);
        println!("Endpoint: {}", health.endpoint);
        println!("Running: {}", health.running);
        println!("Responsive: {}", health.responsive);
        println!("Queue backend: {}", queue_backend.as_str());
        println!(
            "Queue backpressure sleep ms: {}",
            queue_backpressure_sleep_ms
        );
        println!(
            "Pool: max-contexts={} max-pages={} recycle-min-score={} recycle-after-jobs={} page-probe-every={} affinity-ttl-jobs={} affinity-strategy={} affinity-scope={}",
            pool_config.max_contexts_per_worker,
            pool_config.max_pages_per_worker,
            pool_config.recycle_min_score,
            pool_config.recycle_after_jobs,
            pool_config.page_probe_every_jobs,
            pool_config.affinity_ttl_jobs,
            pool_config.affinity_strategy.as_str(),
            pool_config.affinity_scope.as_str()
        );
        println!(
            "Governance: tenant-job-budget={} tenant-failure-budget={} domain-min-interval-ms={} job-timeout-ms={}",
            governance_config.tenant_job_budget,
            governance_config.tenant_failure_budget,
            governance_config.domain_min_interval_ms,
            governance_config.job_timeout_ms
        );
    }

    exit(if health.responsive { 0 } else { 1 });
}

fn run_worker_affinity_stats_command(flags: &flags::Flags) -> ! {
    let stats_path = get_worker_pool_stats_path(&flags.session);
    let raw = match fs::read_to_string(&stats_path) {
        Ok(v) => v,
        Err(e) => {
            if flags.json {
                println!(
                    "{}",
                    json!({
                        "success": false,
                        "error": format!("Worker pool stats not available: {}", e),
                        "data": {
                            "session": flags.session,
                            "statsPath": stats_path,
                        }
                    })
                );
            } else {
                println!("Session: {}", flags.session);
                println!("Stats path: {}", stats_path.display());
                println!("Worker pool stats not available: {}", e);
            }
            exit(1);
        }
    };

    let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap_or_else(|_| json!({}));
    if flags.json {
        println!(
            "{}",
            json!({
                "success": true,
                "data": {
                    "session": flags.session,
                    "statsPath": stats_path,
                    "stats": parsed,
                }
            })
        );
    } else {
        let pool = parsed.get("pool").cloned().unwrap_or_else(|| json!({}));
        let governance = parsed
            .get("governance")
            .cloned()
            .unwrap_or_else(|| json!({}));
        println!("Session: {}", flags.session);
        println!("Stats path: {}", stats_path.display());
        println!(
            "Affinity strategy: {}",
            pool.get("affinityStrategy")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
        );
        println!(
            "Affinity scope: {}",
            pool.get("affinityScope")
                .and_then(|v| v.as_str())
                .unwrap_or("context")
        );
        println!(
            "Affinities: {}",
            pool.get("affinities").and_then(|v| v.as_u64()).unwrap_or(0)
        );
        println!(
            "Affinity hits: {}",
            pool.get("affinityHits")
                .and_then(|v| v.as_u64())
                .unwrap_or(0)
        );
        println!(
            "Affinity misses: {}",
            pool.get("affinityMisses")
                .and_then(|v| v.as_u64())
                .unwrap_or(0)
        );
        println!(
            "Contexts: {}/{}",
            pool.get("contexts").and_then(|v| v.as_u64()).unwrap_or(0),
            pool.get("maxContexts")
                .and_then(|v| v.as_u64())
                .unwrap_or(0)
        );
        println!(
            "Pages: {}/{}",
            pool.get("totalPages").and_then(|v| v.as_u64()).unwrap_or(0),
            pool.get("maxPages").and_then(|v| v.as_u64()).unwrap_or(0)
        );
        println!(
            "Backpressure totals: blocked={} terminal-failed={} last-reason={}",
            governance
                .get("blockedTotal")
                .and_then(|v| v.as_u64())
                .unwrap_or(0),
            governance
                .get("terminalFailedTotal")
                .and_then(|v| v.as_u64())
                .unwrap_or(0),
            governance
                .get("lastReasonCode")
                .and_then(|v| v.as_str())
                .unwrap_or("-")
        );
        let tenants = governance
            .get("tenants")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        if tenants.is_empty() {
            println!("Tenant backpressure: none");
        } else {
            println!("Tenant backpressure:");
            for tenant in tenants {
                let tenant_name = tenant
                    .get("tenant")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                let blocked = tenant.get("blocked").and_then(|v| v.as_u64()).unwrap_or(0);
                let terminal_failed = tenant
                    .get("terminalFailed")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
                let last_reason = tenant
                    .get("lastReasonCode")
                    .and_then(|v| v.as_str())
                    .unwrap_or("-");
                println!(
                    "  - {} blocked={} terminal-failed={} last-reason={}",
                    tenant_name, blocked, terminal_failed, last_reason
                );
            }
        }
    }
    exit(0);
}

fn run_session(args: &[String], session: &str, json_mode: bool) {
    let subcommand = args.get(1).map(|s| s.as_str());

    match subcommand {
        Some("list") => {
            let socket_dir = get_socket_dir();
            let mut sessions: Vec<String> = Vec::new();

            if let Ok(entries) = fs::read_dir(&socket_dir) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    // Look for pid files in socket directory
                    if name.ends_with(".pid") {
                        let session_name = name.strip_suffix(".pid").unwrap_or("");
                        if !session_name.is_empty() {
                            // Check if session is actually running
                            let pid_path = socket_dir.join(&name);
                            if let Ok(pid_str) = fs::read_to_string(&pid_path) {
                                if let Ok(pid) = pid_str.trim().parse::<u32>() {
                                    #[cfg(unix)]
                                    let running = unsafe {
                                        libc::kill(pid as i32, 0) == 0
                                            || std::io::Error::last_os_error().raw_os_error()
                                                != Some(libc::ESRCH)
                                    };
                                    #[cfg(windows)]
                                    let running = unsafe {
                                        let handle =
                                            OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
                                        if handle != 0 {
                                            CloseHandle(handle);
                                            true
                                        } else {
                                            false
                                        }
                                    };
                                    if running {
                                        sessions.push(session_name.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if json_mode {
                println!(
                    r#"{{"success":true,"data":{{"sessions":{}}}}}"#,
                    serde_json::to_string(&sessions).unwrap_or_default()
                );
            } else if sessions.is_empty() {
                println!("No active sessions");
            } else {
                println!("Active sessions:");
                for s in &sessions {
                    let marker = if s == session {
                        color::cyan("→")
                    } else {
                        " ".to_string()
                    };
                    println!("{} {}", marker, s);
                }
            }
        }
        None | Some(_) => {
            // Just show current session
            if json_mode {
                println!(r#"{{"success":true,"data":{{"session":"{}"}}}}"#, session);
            } else {
                println!("{}", session);
            }
        }
    }
}

fn main() {
    // Ignore SIGPIPE to prevent panic when piping to head/tail
    #[cfg(unix)]
    unsafe {
        libc::signal(libc::SIGPIPE, libc::SIG_DFL);
    }

    // Prevent MSYS/Git Bash path translation from mangling arguments
    #[cfg(windows)]
    {
        env::set_var("MSYS_NO_PATHCONV", "1");
        env::set_var("MSYS2_ARG_CONV_EXCL", "*");
    }

    // Native daemon mode: when AGENT_BROWSER_DAEMON is set, run as the daemon process
    if env::var("AGENT_BROWSER_DAEMON").is_ok() {
        // Ignore SIGPIPE so the daemon isn't killed when the parent drops
        // the piped stderr handle after confirming the daemon is ready.
        #[cfg(unix)]
        unsafe {
            libc::signal(libc::SIGPIPE, libc::SIG_IGN);
        }
        let session = env::var("AGENT_BROWSER_SESSION").unwrap_or_else(|_| "default".to_string());
        let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
        rt.block_on(native::daemon::run_daemon(&session));
        return;
    }

    let args: Vec<String> = env::args().skip(1).collect();
    let mut flags = parse_flags(&args);
    let clean = clean_args(&args);

    if flags.engine.is_some() && !flags.native {
        flags.native = true;
    }

    let has_help = args.iter().any(|a| a == "--help" || a == "-h");
    let has_version = args.iter().any(|a| a == "--version" || a == "-V");

    if has_help {
        if let Some(cmd) = clean.first() {
            if print_command_help(cmd) {
                return;
            }
        }
        print_help();
        return;
    }

    if has_version {
        print_version();
        return;
    }

    if clean.is_empty() {
        print_help();
        return;
    }

    // Handle install separately
    if clean.first().map(|s| s.as_str()) == Some("install") {
        let with_deps = args.iter().any(|a| a == "--with-deps" || a == "-d");
        run_install(with_deps);
        return;
    }

    // Handle session separately (doesn't need daemon)
    if clean.first().map(|s| s.as_str()) == Some("session") {
        run_session(&clean, &flags.session, flags.json);
        return;
    }

    // Worker shim commands (queue/ops friendly, no human interactive flow required)
    if clean.first().map(|s| s.as_str()) == Some("health") {
        run_health_command(&flags);
    }
    if clean.first().map(|s| s.as_str()) == Some("run-job") {
        run_single_job_command(&clean, &flags);
    }
    if clean.first().map(|s| s.as_str()) == Some("worker")
        && clean.get(1).map(|s| s.as_str()) == Some("affinity-stats")
    {
        run_worker_affinity_stats_command(&flags);
    }
    if clean.first().map(|s| s.as_str()) == Some("worker") {
        run_worker_command(&clean, &flags);
    }

    let mut cmd = match parse_command(&clean, &flags) {
        Ok(c) => c,
        Err(e) => {
            if flags.json {
                let error_type = match &e {
                    ParseError::UnknownCommand { .. } => "unknown_command",
                    ParseError::UnknownSubcommand { .. } => "unknown_subcommand",
                    ParseError::MissingArguments { .. } => "missing_arguments",
                    ParseError::InvalidValue { .. } => "invalid_value",
                    ParseError::InvalidSessionName { .. } => "invalid_session_name",
                };
                println!(
                    r#"{{"success":false,"error":"{}","type":"{}"}}"#,
                    e.format().replace('\n', " "),
                    error_type
                );
            } else {
                eprintln!("{}", color::red(&e.format()));
            }
            exit(1);
        }
    };

    // Handle --password-stdin for auth save
    if cmd.get("action").and_then(|v| v.as_str()) == Some("auth_save") {
        if cmd.get("password").is_some() {
            eprintln!(
                "{} Passwords on the command line may be visible in process listings and shell history. Use --password-stdin instead.",
                color::warning_indicator()
            );
        }
        if cmd
            .get("passwordStdin")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            let mut pass = String::new();
            if std::io::stdin().read_line(&mut pass).is_err() || pass.is_empty() {
                eprintln!(
                    "{} Failed to read password from stdin",
                    color::error_indicator()
                );
                exit(1);
            }
            let pass = pass.trim_end_matches('\n').trim_end_matches('\r');
            if pass.is_empty() {
                eprintln!("{} Password from stdin is empty", color::error_indicator());
                exit(1);
            }
            cmd["password"] = json!(pass);
            cmd.as_object_mut().unwrap().remove("passwordStdin");
        }
    }

    // Handle local auth commands without starting the daemon.
    // These don't need a browser, so we avoid sending passwords through the socket.
    if let Some(action) = cmd.get("action").and_then(|v| v.as_str()) {
        if matches!(
            action,
            "auth_save" | "auth_list" | "auth_show" | "auth_delete"
        ) {
            run_auth_cli(&cmd, flags.json);
        }
    }

    // Validate session name before starting daemon
    if let Some(ref name) = flags.session_name {
        if !validation::is_valid_session_name(name) {
            let msg = validation::session_name_error(name);
            if flags.json {
                println!(
                    r#"{{"success":false,"error":"{}","type":"invalid_session_name"}}"#,
                    msg.replace('"', "\\\"")
                );
            } else {
                eprintln!("{} {}", color::error_indicator(), msg);
            }
            exit(1);
        }
    }

    let daemon_opts = daemon_options_from_flags(&flags);
    let daemon_result = match ensure_daemon(&flags.session, &daemon_opts) {
        Ok(result) => result,
        Err(e) => {
            if flags.json {
                println!(r#"{{"success":false,"error":"{}"}}"#, e);
            } else {
                eprintln!("{} {}", color::error_indicator(), e);
            }
            exit(1);
        }
    };

    // Warn if launch-time options were explicitly passed via CLI but daemon was already running
    // Only warn about flags that were passed on the command line, not those set via environment
    // variables (since the daemon already uses the env vars when it starts).
    if daemon_result.already_running {
        let ignored_flags: Vec<&str> = [
            if flags.cli_executable_path {
                Some("--executable-path")
            } else {
                None
            },
            if flags.cli_extensions {
                Some("--extension")
            } else {
                None
            },
            if flags.cli_profile {
                Some("--profile")
            } else {
                None
            },
            if flags.cli_state {
                Some("--state")
            } else {
                None
            },
            if flags.cli_args { Some("--args") } else { None },
            if flags.cli_user_agent {
                Some("--user-agent")
            } else {
                None
            },
            if flags.cli_proxy {
                Some("--proxy")
            } else {
                None
            },
            if flags.cli_proxy_bypass {
                Some("--proxy-bypass")
            } else {
                None
            },
            flags.ignore_https_errors.then_some("--ignore-https-errors"),
            flags.cli_allow_file_access.then_some("--allow-file-access"),
            flags.cli_download_path.then_some("--download-path"),
            flags.cli_native.then_some("--native"),
        ]
        .into_iter()
        .flatten()
        .collect();

        if !ignored_flags.is_empty() && !flags.json {
            eprintln!(
                "{} {} ignored: daemon already running. Use 'agent-browser close' first to restart with new options.",
                color::warning_indicator(),
                ignored_flags.join(", ")
            );
        }
    }

    // Validate mutually exclusive options
    if flags.cdp.is_some() && flags.provider.is_some() {
        let msg = "Cannot use --cdp and -p/--provider together";
        if flags.json {
            println!(r#"{{"success":false,"error":"{}"}}"#, msg);
        } else {
            eprintln!("{} {}", color::error_indicator(), msg);
        }
        exit(1);
    }

    if flags.auto_connect && flags.cdp.is_some() {
        let msg = "Cannot use --auto-connect and --cdp together";
        if flags.json {
            println!(r#"{{"success":false,"error":"{}"}}"#, msg);
        } else {
            eprintln!("{} {}", color::error_indicator(), msg);
        }
        exit(1);
    }

    if flags.auto_connect && flags.provider.is_some() {
        let msg = "Cannot use --auto-connect and -p/--provider together";
        if flags.json {
            println!(r#"{{"success":false,"error":"{}"}}"#, msg);
        } else {
            eprintln!("{} {}", color::error_indicator(), msg);
        }
        exit(1);
    }

    if flags.provider.is_some() && !flags.extensions.is_empty() {
        let msg = "Cannot use --extension with -p/--provider (extensions require local browser)";
        if flags.json {
            println!(r#"{{"success":false,"error":"{}"}}"#, msg);
        } else {
            eprintln!("{} {}", color::error_indicator(), msg);
        }
        exit(1);
    }

    if flags.cdp.is_some() && !flags.extensions.is_empty() {
        let msg = "Cannot use --extension with --cdp (extensions require local browser)";
        if flags.json {
            println!(r#"{{"success":false,"error":"{}"}}"#, msg);
        } else {
            eprintln!("{} {}", color::error_indicator(), msg);
        }
        exit(1);
    }

    // Auto-connect to existing browser
    if flags.auto_connect {
        let mut launch_cmd = json!({
            "id": gen_id(),
            "action": "launch",
            "autoConnect": true
        });

        if flags.ignore_https_errors {
            launch_cmd["ignoreHTTPSErrors"] = json!(true);
        }

        if let Some(ref cs) = flags.color_scheme {
            launch_cmd["colorScheme"] = json!(cs);
        }

        if let Some(ref dp) = flags.download_path {
            launch_cmd["downloadPath"] = json!(dp);
        }

        let err = match send_command(launch_cmd, &flags.session) {
            Ok(resp) if resp.success => None,
            Ok(resp) => Some(
                resp.error
                    .unwrap_or_else(|| "Auto-connect failed".to_string()),
            ),
            Err(e) => Some(e.to_string()),
        };

        if let Some(msg) = err {
            if flags.json {
                println!(r#"{{"success":false,"error":"{}"}}"#, msg);
            } else {
                eprintln!("{} {}", color::error_indicator(), msg);
            }
            exit(1);
        }
    }

    // Connect via CDP if --cdp flag is set
    // Accepts either a port number (e.g., "9222") or a full URL (e.g., "ws://..." or "wss://...")
    if let Some(ref cdp_value) = flags.cdp {
        let mut launch_cmd = if cdp_value.starts_with("ws://")
            || cdp_value.starts_with("wss://")
            || cdp_value.starts_with("http://")
            || cdp_value.starts_with("https://")
        {
            // It's a URL - use cdpUrl field
            json!({
                "id": gen_id(),
                "action": "launch",
                "cdpUrl": cdp_value
            })
        } else {
            // It's a port number - validate and use cdpPort field
            let cdp_port: u16 = match cdp_value.parse::<u32>() {
                Ok(0) => {
                    let msg = "Invalid CDP port: port must be greater than 0".to_string();
                    if flags.json {
                        println!(r#"{{"success":false,"error":"{}"}}"#, msg);
                    } else {
                        eprintln!("{} {}", color::error_indicator(), msg);
                    }
                    exit(1);
                }
                Ok(p) if p > 65535 => {
                    let msg = format!(
                        "Invalid CDP port: {} is out of range (valid range: 1-65535)",
                        p
                    );
                    if flags.json {
                        println!(r#"{{"success":false,"error":"{}"}}"#, msg);
                    } else {
                        eprintln!("{} {}", color::error_indicator(), msg);
                    }
                    exit(1);
                }
                Ok(p) => p as u16,
                Err(_) => {
                    let msg = format!(
                        "Invalid CDP value: '{}' is not a valid port number or URL",
                        cdp_value
                    );
                    if flags.json {
                        println!(r#"{{"success":false,"error":"{}"}}"#, msg);
                    } else {
                        eprintln!("{} {}", color::error_indicator(), msg);
                    }
                    exit(1);
                }
            };
            json!({
                "id": gen_id(),
                "action": "launch",
                "cdpPort": cdp_port
            })
        };

        if flags.ignore_https_errors {
            launch_cmd["ignoreHTTPSErrors"] = json!(true);
        }

        if let Some(ref cs) = flags.color_scheme {
            launch_cmd["colorScheme"] = json!(cs);
        }

        if let Some(ref dp) = flags.download_path {
            launch_cmd["downloadPath"] = json!(dp);
        }

        let err = match send_command(launch_cmd, &flags.session) {
            Ok(resp) if resp.success => None,
            Ok(resp) => Some(
                resp.error
                    .unwrap_or_else(|| "CDP connection failed".to_string()),
            ),
            Err(e) => Some(e.to_string()),
        };

        if let Some(msg) = err {
            if flags.json {
                println!(r#"{{"success":false,"error":"{}"}}"#, msg);
            } else {
                eprintln!("{} {}", color::error_indicator(), msg);
            }
            exit(1);
        }
    }

    // Launch with cloud provider if -p flag is set
    if let Some(ref provider) = flags.provider {
        let mut launch_cmd = json!({
            "id": gen_id(),
            "action": "launch",
            "provider": provider
        });

        if let Some(ref cs) = flags.color_scheme {
            launch_cmd["colorScheme"] = json!(cs);
        }

        let err = match send_command(launch_cmd, &flags.session) {
            Ok(resp) if resp.success => None,
            Ok(resp) => Some(
                resp.error
                    .unwrap_or_else(|| "Provider connection failed".to_string()),
            ),
            Err(e) => Some(e.to_string()),
        };

        if let Some(msg) = err {
            if flags.json {
                println!(r#"{{"success":false,"error":"{}"}}"#, msg);
            } else {
                eprintln!("{} {}", color::error_indicator(), msg);
            }
            exit(1);
        }
    }

    // Launch headed browser or configure browser options (without CDP or provider)
    if (flags.headed
        || flags.executable_path.is_some()
        || flags.profile.is_some()
        || flags.state.is_some()
        || flags.proxy.is_some()
        || flags.args.is_some()
        || flags.user_agent.is_some()
        || flags.allow_file_access
        || flags.color_scheme.is_some()
        || flags.download_path.is_some()
        || flags.engine.is_some())
        && flags.cdp.is_none()
        && flags.provider.is_none()
    {
        let mut launch_cmd = json!({
            "id": gen_id(),
            "action": "launch",
            "headless": !flags.headed
        });

        let cmd_obj = launch_cmd
            .as_object_mut()
            .expect("json! macro guarantees object type");

        // Add executable path if specified
        if let Some(ref exec_path) = flags.executable_path {
            cmd_obj.insert("executablePath".to_string(), json!(exec_path));
        }

        // Add profile path if specified
        if let Some(ref profile_path) = flags.profile {
            cmd_obj.insert("profile".to_string(), json!(profile_path));
        }

        // Add state path if specified
        if let Some(ref state_path) = flags.state {
            cmd_obj.insert("storageState".to_string(), json!(state_path));
        }

        if let Some(ref proxy_str) = flags.proxy {
            let mut proxy_obj = parse_proxy(proxy_str);
            // Add bypass if specified
            if let Some(ref bypass) = flags.proxy_bypass {
                if let Some(obj) = proxy_obj.as_object_mut() {
                    obj.insert("bypass".to_string(), json!(bypass));
                }
            }
            cmd_obj.insert("proxy".to_string(), proxy_obj);
        }

        if let Some(ref ua) = flags.user_agent {
            cmd_obj.insert("userAgent".to_string(), json!(ua));
        }

        if let Some(ref a) = flags.args {
            // Parse args (comma or newline separated)
            let args_vec: Vec<String> = a
                .split(&[',', '\n'][..])
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            cmd_obj.insert("args".to_string(), json!(args_vec));
        }

        if flags.ignore_https_errors {
            launch_cmd["ignoreHTTPSErrors"] = json!(true);
        }

        if flags.allow_file_access {
            launch_cmd["allowFileAccess"] = json!(true);
        }

        if let Some(ref cs) = flags.color_scheme {
            launch_cmd["colorScheme"] = json!(cs);
        }

        if let Some(ref dp) = flags.download_path {
            launch_cmd["downloadPath"] = json!(dp);
        }

        if let Some(ref domains) = flags.allowed_domains {
            launch_cmd["allowedDomains"] = json!(domains);
        }

        if let Some(ref engine) = flags.engine {
            launch_cmd["engine"] = json!(engine);
        }

        match send_command(launch_cmd, &flags.session) {
            Ok(resp) if !resp.success => {
                // Launch command failed (e.g., invalid state file, profile error)
                let error_msg = resp
                    .error
                    .unwrap_or_else(|| "Browser launch failed".to_string());
                if flags.json {
                    println!(r#"{{"success":false,"error":"{}"}}"#, error_msg);
                } else {
                    eprintln!("{} {}", color::error_indicator(), error_msg);
                }
                exit(1);
            }
            Err(e) => {
                if flags.json {
                    println!(r#"{{"success":false,"error":"{}"}}"#, e);
                } else {
                    eprintln!(
                        "{} Could not configure browser: {}",
                        color::error_indicator(),
                        e
                    );
                }
                exit(1);
            }
            Ok(_) => {
                // Launch succeeded
            }
        }
    }

    let output_opts = OutputOptions {
        json: flags.json,
        content_boundaries: flags.content_boundaries,
        max_output: flags.max_output,
    };

    match send_command(cmd.clone(), &flags.session) {
        Ok(resp) => {
            let success = resp.success;
            // Handle interactive confirmation
            if flags.confirm_interactive {
                if let Some(data) = &resp.data {
                    if data
                        .get("confirmation_required")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false)
                    {
                        let desc = data
                            .get("description")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown action");
                        let category = data.get("category").and_then(|v| v.as_str()).unwrap_or("");
                        let cid = data
                            .get("confirmation_id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");

                        eprintln!("[agent-browser] Action requires confirmation:");
                        eprintln!("  {}: {}", category, desc);
                        eprint!("  Allow? [y/N]: ");

                        let mut input = String::new();
                        let approved = if std::io::IsTerminal::is_terminal(&std::io::stdin()) {
                            std::io::stdin().read_line(&mut input).is_ok()
                                && matches!(input.trim().to_lowercase().as_str(), "y" | "yes")
                        } else {
                            false
                        };

                        let confirm_cmd = if approved {
                            json!({ "id": gen_id(), "action": "confirm", "confirmationId": cid })
                        } else {
                            json!({ "id": gen_id(), "action": "deny", "confirmationId": cid })
                        };

                        match send_command(confirm_cmd, &flags.session) {
                            Ok(r) => {
                                if !approved {
                                    eprintln!("{} Action denied", color::error_indicator());
                                    exit(1);
                                }
                                print_response_with_opts(&r, None, &output_opts);
                            }
                            Err(e) => {
                                eprintln!("{} {}", color::error_indicator(), e);
                                exit(1);
                            }
                        }
                        return;
                    }
                }
            }
            // Extract action for context-specific output handling
            let action = cmd.get("action").and_then(|v| v.as_str());
            print_response_with_opts(&resp, action, &output_opts);
            if !success {
                exit(1);
            }
        }
        Err(e) => {
            if flags.json {
                println!(r#"{{"success":false,"error":"{}"}}"#, e);
            } else {
                eprintln!("{} {}", color::error_indicator(), e);
            }
            exit(1);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_proxy_simple() {
        let result = parse_proxy("http://proxy.com:8080");
        assert_eq!(result["server"], "http://proxy.com:8080");
        assert!(result.get("username").is_none());
        assert!(result.get("password").is_none());
    }

    #[test]
    fn test_parse_proxy_with_auth() {
        let result = parse_proxy("http://user:pass@proxy.com:8080");
        assert_eq!(result["server"], "http://proxy.com:8080");
        assert_eq!(result["username"], "user");
        assert_eq!(result["password"], "pass");
    }

    #[test]
    fn test_parse_proxy_username_only() {
        let result = parse_proxy("http://user@proxy.com:8080");
        assert_eq!(result["server"], "http://proxy.com:8080");
        assert_eq!(result["username"], "user");
        assert_eq!(result["password"], "");
    }

    #[test]
    fn test_parse_proxy_no_protocol() {
        let result = parse_proxy("proxy.com:8080");
        assert_eq!(result["server"], "proxy.com:8080");
        assert!(result.get("username").is_none());
    }

    #[test]
    fn test_parse_proxy_socks5() {
        let result = parse_proxy("socks5://proxy.com:1080");
        assert_eq!(result["server"], "socks5://proxy.com:1080");
        assert!(result.get("username").is_none());
    }

    #[test]
    fn test_parse_proxy_socks5_with_auth() {
        let result = parse_proxy("socks5://admin:secret@proxy.com:1080");
        assert_eq!(result["server"], "socks5://proxy.com:1080");
        assert_eq!(result["username"], "admin");
        assert_eq!(result["password"], "secret");
    }

    #[test]
    fn test_parse_proxy_complex_password() {
        let result = parse_proxy("http://user:p@ss:w0rd@proxy.com:8080");
        assert_eq!(result["server"], "http://proxy.com:8080");
        assert_eq!(result["username"], "user");
        assert_eq!(result["password"], "p@ss:w0rd");
    }

    #[test]
    fn test_parse_job_request_command_shape() {
        let raw = r#"{"jobId":"j1","session":"s1","command":{"action":"snapshot"}}"#;
        let job = parse_job_request(raw).expect("job should parse");
        assert_eq!(job.job_id.as_deref(), Some("j1"));
        assert_eq!(job.session.as_deref(), Some("s1"));
        assert_eq!(
            job.command
                .as_ref()
                .and_then(|v| v.get("action"))
                .and_then(|v| v.as_str()),
            Some("snapshot")
        );
        assert!(job.argv.is_none());
    }

    #[test]
    fn test_parse_job_request_argv_shape() {
        let raw = r#"{"job_id":"j2","argv":["open","example.com"]}"#;
        let job = parse_job_request(raw).expect("job should parse");
        assert_eq!(job.job_id.as_deref(), Some("j2"));
        assert_eq!(job.argv.as_ref().map(|v| v.len()), Some(2));
        assert!(job.command.is_none());
    }

    #[test]
    fn test_parse_job_request_affinity_fields() {
        let raw = r#"{"jobId":"j4","tenantId":"t1","workflow_id":"wf1","contextId":"c9","argv":["snapshot"]}"#;
        let job = parse_job_request(raw).expect("job should parse");
        assert_eq!(job.tenant_id.as_deref(), Some("t1"));
        assert_eq!(job.workflow_id.as_deref(), Some("wf1"));
        assert_eq!(job.context_id.as_deref(), Some("c9"));
        assert_eq!(
            job.affinity_key(AffinityScope::Context).as_deref(),
            Some("tenant:t1|workflow:wf1|context:c9")
        );
    }

    #[test]
    fn test_job_request_affinity_key_explicit_takes_precedence() {
        let raw = r#"{"jobId":"j5","affinityKey":"lead-123","tenantId":"t1","argv":["snapshot"]}"#;
        let job = parse_job_request(raw).expect("job should parse");
        assert_eq!(
            job.affinity_key(AffinityScope::Context).as_deref(),
            Some("lead-123")
        );
    }

    #[test]
    fn test_job_request_affinity_scope_session_excludes_context_dimension() {
        let raw = r#"{"jobId":"j6","tenantId":"t1","workflowId":"w1","contextId":"c1","argv":["snapshot"]}"#;
        let job = parse_job_request(raw).expect("job should parse");
        assert_eq!(
            job.affinity_key(AffinityScope::Session).as_deref(),
            Some("tenant:t1|workflow:w1")
        );
    }

    #[test]
    fn test_parse_job_request_affinity_scope_override() {
        let raw = r#"{"jobId":"j7","tenantId":"t1","contextId":"c1","affinity_scope":"session","argv":["snapshot"]}"#;
        let job = parse_job_request(raw).expect("job should parse");
        assert_eq!(job.affinity_scope, Some(AffinityScope::Session));
        assert_eq!(
            job.affinity_key(AffinityScope::Context).as_deref(),
            Some("tenant:t1")
        );
    }

    #[test]
    fn test_parse_job_request_affinity_scope_invalid() {
        let raw = r#"{"jobId":"j8","tenantId":"t1","affinityScope":"team","argv":["snapshot"]}"#;
        match parse_job_request(raw) {
            Ok(_) => panic!("job should fail"),
            Err(err) => assert!(
                err.contains("'affinity_scope' must be 'session' or 'context'"),
                "unexpected error: {}",
                err
            ),
        }
    }

    #[test]
    fn test_pool_affinity_sticky_session() {
        let mut pool = WorkerBrowserPool::new("default");
        pool.config.max_contexts_per_worker = 3;
        pool.config.affinity_ttl_jobs = 100;

        let (s1, k1, h1) = pool.pick_session_for_job(None, Some("tenant:a|context:1"));
        let (s2, k2, h2) = pool.pick_session_for_job(None, Some("tenant:a|context:1"));

        assert_eq!(k1.as_deref(), Some("tenant:a|context:1"));
        assert_eq!(k2.as_deref(), Some("tenant:a|context:1"));
        assert!(!h1);
        assert!(h2);
        assert_eq!(s1, s2);
    }

    #[test]
    fn test_pool_affinity_strategy_none_disables_hits() {
        let mut pool = WorkerBrowserPool::new("default");
        pool.config.max_contexts_per_worker = 3;
        pool.config.affinity_strategy = AffinityStrategy::None;

        let (_s1, _k1, h1) = pool.pick_session_for_job(None, Some("tenant:a|context:1"));
        let (_s2, _k2, h2) = pool.pick_session_for_job(None, Some("tenant:a|context:1"));

        assert!(!h1);
        assert!(!h2);
        assert_eq!(pool.affinity_count(), 0);
    }

    #[test]
    fn test_extract_job_domain_from_argv_open() {
        let job = JobRequest {
            argv: Some(vec!["open".to_string(), "example.com/path".to_string()]),
            ..Default::default()
        };
        assert_eq!(extract_job_domain(&job).as_deref(), Some("example.com"));
    }

    #[test]
    fn test_governance_domain_rate_limit_blocks_second_hit() {
        let mut gov = WorkerGovernance {
            config: WorkerGovernanceConfig {
                tenant_job_budget: 0,
                tenant_failure_budget: 0,
                domain_min_interval_ms: 60_000,
                job_timeout_ms: 0,
            },
            tenants: HashMap::new(),
            domains: HashMap::new(),
            blocked_total: 0,
            terminal_failed_total: 0,
            last_reason_code: None,
        };
        let job = JobRequest {
            argv: Some(vec!["open".to_string(), "https://example.com".to_string()]),
            ..Default::default()
        };
        assert!(gov.admit(&job).is_ok());
        let rejection = gov
            .admit(&job)
            .expect_err("second call should be rate-limited");
        assert_eq!(rejection.code, "domain_rate_limited");
        assert!(!rejection.hard_cap);
        assert!(rejection.retry_after_ms.is_some());
    }

    #[test]
    fn test_governance_tenant_job_budget_hard_cap() {
        let mut gov = WorkerGovernance {
            config: WorkerGovernanceConfig {
                tenant_job_budget: 2,
                tenant_failure_budget: 0,
                domain_min_interval_ms: 0,
                job_timeout_ms: 0,
            },
            tenants: HashMap::new(),
            domains: HashMap::new(),
            blocked_total: 0,
            terminal_failed_total: 0,
            last_reason_code: None,
        };
        let mut job = JobRequest {
            tenant_id: Some("tenant-a".to_string()),
            budget_cost: Some(1),
            argv: Some(vec!["snapshot".to_string()]),
            ..Default::default()
        };
        assert!(gov.admit(&job).is_ok());
        gov.record_result(&job, true);
        assert!(gov.admit(&job).is_ok());
        gov.record_result(&job, true);

        job.job_id = Some("j-hard-cap".to_string());
        let rejection = gov.admit(&job).expect_err("budget must hard-cap");
        assert_eq!(rejection.code, "tenant_job_budget_exceeded");
        assert!(rejection.hard_cap);
        assert_eq!(rejection.tenant.as_deref(), Some("tenant-a"));
    }

    #[test]
    fn test_governance_records_tenant_backpressure_counters() {
        let mut gov = WorkerGovernance {
            config: WorkerGovernanceConfig {
                tenant_job_budget: 1,
                tenant_failure_budget: 0,
                domain_min_interval_ms: 0,
                job_timeout_ms: 0,
            },
            tenants: HashMap::new(),
            domains: HashMap::new(),
            blocked_total: 0,
            terminal_failed_total: 0,
            last_reason_code: None,
        };
        let job = JobRequest {
            tenant_id: Some("tenant-a".to_string()),
            budget_cost: Some(1),
            argv: Some(vec!["snapshot".to_string()]),
            ..Default::default()
        };
        assert!(gov.admit(&job).is_ok());
        gov.record_result(&job, true);
        let rejection = gov
            .admit(&job)
            .expect_err("should hit tenant budget hard-cap");
        gov.record_backpressure(&job, &rejection, rejection.hard_cap);

        let state = gov
            .tenants
            .get("tenant-a")
            .expect("tenant state should exist");
        assert_eq!(state.blocked, 1);
        assert_eq!(state.terminal_failed, 1);
        assert_eq!(
            state.last_reason_code.as_deref(),
            Some("tenant_job_budget_exceeded")
        );
        assert_eq!(gov.blocked_total, 1);
        assert_eq!(gov.terminal_failed_total, 1);
        assert_eq!(
            gov.last_reason_code.as_deref(),
            Some("tenant_job_budget_exceeded")
        );
    }

    #[test]
    fn test_governance_records_global_backpressure_without_tenant() {
        let mut gov = WorkerGovernance {
            config: WorkerGovernanceConfig {
                tenant_job_budget: 0,
                tenant_failure_budget: 0,
                domain_min_interval_ms: 60_000,
                job_timeout_ms: 0,
            },
            tenants: HashMap::new(),
            domains: HashMap::new(),
            blocked_total: 0,
            terminal_failed_total: 0,
            last_reason_code: None,
        };
        let job = JobRequest {
            argv: Some(vec!["open".to_string(), "https://example.com".to_string()]),
            ..Default::default()
        };
        assert!(gov.admit(&job).is_ok());
        let rejection = gov
            .admit(&job)
            .expect_err("second call should be rate-limited");
        gov.record_backpressure(&job, &rejection, rejection.hard_cap);
        assert_eq!(gov.blocked_total, 1);
        assert_eq!(gov.terminal_failed_total, 0);
        assert_eq!(gov.last_reason_code.as_deref(), Some("domain_rate_limited"));
        assert!(gov.tenants.is_empty());
    }

    #[test]
    fn test_parse_job_request_requires_command_or_argv() {
        let raw = r#"{"jobId":"j3"}"#;
        assert!(parse_job_request(raw).is_err());
    }

    #[test]
    fn test_extract_tab_count_array() {
        let value = json!([{"id":1},{"id":2}]);
        assert_eq!(extract_tab_count(Some(&value)), Some(2));
    }

    #[test]
    fn test_extract_tab_count_tabs_field() {
        let value = json!({"tabs":[{"id":"a"}]});
        assert_eq!(extract_tab_count(Some(&value)), Some(1));
    }

    #[test]
    fn test_extract_tab_count_missing() {
        let value = json!({"ok":true});
        assert_eq!(extract_tab_count(Some(&value)), None);
        assert_eq!(extract_tab_count(None), None);
    }
}

