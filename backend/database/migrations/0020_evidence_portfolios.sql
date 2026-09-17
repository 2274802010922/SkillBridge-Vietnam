CREATE TABLE IF NOT EXISTS portfolio_packs (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
    current_version INTEGER NOT NULL DEFAULT 1, published_version INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE IF NOT EXISTS portfolio_pack_versions (
    pack_id TEXT NOT NULL REFERENCES portfolio_packs(id), version INTEGER NOT NULL,
    content_json TEXT NOT NULL, sources_json TEXT NOT NULL, content_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(pack_id,version)
  );

CREATE TABLE IF NOT EXISTS evidence_publication_permissions (
    assessment_id TEXT PRIMARY KEY REFERENCES assessments(id), allowed INTEGER NOT NULL DEFAULT 0,
    actor_id TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE IF NOT EXISTS portfolio_grants (
    id TEXT PRIMARY KEY, pack_id TEXT NOT NULL REFERENCES portfolio_packs(id), version INTEGER NOT NULL,
    application_id TEXT NOT NULL REFERENCES opportunity_applications(id), organization_id TEXT NOT NULL REFERENCES organizations(id),
    owner_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL, revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_portfolio_grant ON portfolio_grants(application_id,pack_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS application_notes (
    id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES opportunity_applications(id),
    organization_id TEXT NOT NULL REFERENCES organizations(id), actor_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE IF NOT EXISTS application_events (
    id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES opportunity_applications(id),
    organization_id TEXT NOT NULL REFERENCES organizations(id), actor_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE IF NOT EXISTS feature_trials (
    scope_id TEXT NOT NULL, feature TEXT NOT NULL, provenance TEXT NOT NULL,
    expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(scope_id,feature)
  );

CREATE TABLE IF NOT EXISTS career_operations (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), fingerprint TEXT NOT NULL,
    pack_id TEXT NOT NULL REFERENCES portfolio_packs(id), version INTEGER NOT NULL, locale TEXT NOT NULL,
    status TEXT NOT NULL, result_json TEXT, usage_json TEXT, lease TEXT NOT NULL,
    expires_at INTEGER NOT NULL, budget_day TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_id,fingerprint)
  );

CREATE INDEX IF NOT EXISTS idx_career_budget ON career_operations(owner_id,budget_day,status);
