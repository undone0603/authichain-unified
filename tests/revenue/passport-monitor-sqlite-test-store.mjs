/**
 * TEST-ONLY durable SQLite adapter for dormant Passport Monitor.
 * Uses Node 22 node:sqlite. Never import into production.
 * BEGIN IMMEDIATE serializes changes to this disposable local database;
 * this does not establish multi-instance production DB correctness.
 */
import { DatabaseSync } from 'node:sqlite';
export function createTestSqliteStore(filename) {
  if (typeof filename !== 'string' || !filename) throw new TypeError('disposable db filename required');
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS passport_monitor_subscriptions (
      subscription_id TEXT PRIMARY KEY, state_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS passport_monitor_events (
      event_id TEXT PRIMARY KEY, subscription_id TEXT NOT NULL
    );`);
  const readState = db.prepare('SELECT state_json FROM passport_monitor_subscriptions WHERE subscription_id = ?');
  const readIds = db.prepare('SELECT event_id FROM passport_monitor_events WHERE subscription_id = ?');
  const writeState = db.prepare(`INSERT INTO passport_monitor_subscriptions(subscription_id,state_json)
    VALUES(?,?) ON CONFLICT(subscription_id) DO UPDATE SET state_json=excluded.state_json`);
  const claim = db.prepare('INSERT INTO passport_monitor_events(event_id,subscription_id) VALUES(?,?)');
  return {
    async transact(subscriptionId, decide) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = readState.get(subscriptionId);
        const state = row ? JSON.parse(row.state_json) : null;
        const eventIds = new Set(readIds.all(subscriptionId).map(x => x.event_id));
        const result = decide({ state, eventIds });
        if (result?.commit) {
          if (!result.state || typeof result.state !== 'object') throw new Error('missing committed state');
          if (result.claimedEventId) claim.run(result.claimedEventId,subscriptionId);
          writeState.run(subscriptionId,JSON.stringify(result.state));
        }
        db.exec('COMMIT');
        return result;
      } catch(error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    read(subscriptionId) {
      const row = readState.get(subscriptionId);
      return row ? JSON.parse(row.state_json) : null;
    },
    eventCount() { return db.prepare('SELECT COUNT(*) AS n FROM passport_monitor_events').get().n; },
    close() { db.close(); },
  };
}
