export const RELIABILITY_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS escrow_operation_expectations (operation_id TEXT PRIMARY KEY REFERENCES escrow_operations(id), instructions_json TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS milestone_payment_intents (milestone_id TEXT PRIMARY KEY REFERENCES contract_milestones(id), snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS milestone_signature_claims (signature TEXT PRIMARY KEY, milestone_id TEXT NOT NULL UNIQUE REFERENCES contract_milestones(id), verified INTEGER NOT NULL DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS issuer_bootstrap_steps (operation_key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, prepared_json TEXT, lease TEXT, lease_until INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
];
