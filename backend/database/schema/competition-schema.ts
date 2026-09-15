export const COMPETITION_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS opportunity_details (
    opportunity_id TEXT PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
    requirements TEXT NOT NULL DEFAULT '', closes_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS opportunity_applications (
    id TEXT PRIMARY KEY, opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
    user_id TEXT NOT NULL REFERENCES users(id), credential_id TEXT NOT NULL REFERENCES skill_credentials(id),
    wallet_address TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'submitted',
    profile_json TEXT NOT NULL, verification_json TEXT NOT NULL,
    receipt_address TEXT, record_tx TEXT, submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(opportunity_id,user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS sponsored_claims (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), escrow_address TEXT NOT NULL,
    recipient TEXT NOT NULL, message_base64 TEXT NOT NULL, unsigned_base64 TEXT NOT NULL,
    signed_base64 TEXT, signature TEXT, last_valid_height TEXT NOT NULL,
    status TEXT NOT NULL, reserve_lamports INTEGER NOT NULL, budget_day TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsor_live_claim ON sponsored_claims(escrow_address,recipient) WHERE status IN ('prepared','broadcast','finalized')`,
  `CREATE TABLE IF NOT EXISTS sponsor_daily_budget (day TEXT PRIMARY KEY,reserved INTEGER NOT NULL DEFAULT 0)`,
];
