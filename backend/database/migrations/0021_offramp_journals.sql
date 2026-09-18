CREATE TABLE IF NOT EXISTS offramp_operations (
    operation_key TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES cashout_sessions(id),
    payload_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
    result_json TEXT, last_error TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE IF NOT EXISTS offramp_inbox (
    identity TEXT PRIMARY KEY, provider TEXT NOT NULL, mode TEXT NOT NULL, event_id TEXT NOT NULL,
    order_id TEXT NOT NULL, payload_hash TEXT NOT NULL, event_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received', lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, next_retry_at INTEGER NOT NULL DEFAULT 0,
    processed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE INDEX IF NOT EXISTS idx_offramp_inbox_order ON offramp_inbox(order_id, status);

CREATE TABLE IF NOT EXISTS offramp_signature_claims (
    signature TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES cashout_sessions(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
