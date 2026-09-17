CREATE TABLE IF NOT EXISTS credential_issuance_operations (
  assessment_id TEXT PRIMARY KEY REFERENCES assessments(id),
  challenge_id TEXT NOT NULL REFERENCES challenges(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  student_user_id TEXT NOT NULL REFERENCES users(id),
  fingerprint TEXT NOT NULL, payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved', prepared_json TEXT,
  signature TEXT, attestation_address TEXT, lease TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
  last_error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_issuance_capacity ON credential_issuance_operations(challenge_id,status);
