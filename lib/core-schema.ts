import { PROFILE_SCHEMA } from './wallet-profile.ts';
import { ESCROW_SCHEMA, ESCROW_TRIGGERS } from './escrow-schema.ts';

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    profile_kind TEXT NOT NULL DEFAULT 'student',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS wallets (
    address TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chain TEXT NOT NULL DEFAULT 'solana:devnet',
    verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_signed_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  PROFILE_SCHEMA,
  ...ESCROW_SCHEMA,
  `CREATE TABLE IF NOT EXISTS auth_nonces (
    id TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    domain TEXT NOT NULL,
    uri TEXT NOT NULL,
    chain_id TEXT NOT NULL,
    statement TEXT NOT NULL,
    request_id TEXT NOT NULL,
    issued_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    description TEXT,
    website TEXT,
    verification_status TEXT NOT NULL DEFAULT 'unverified',
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS invitations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    target_wallet TEXT,
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    accepted_by_user_id TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    reviewer_organization_id TEXT REFERENCES organizations(id),
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    brief TEXT NOT NULL,
    content_json TEXT NOT NULL DEFAULT '{}',
    skills_json TEXT NOT NULL DEFAULT '[]',
    rubric_json TEXT NOT NULL,
    reward TEXT NOT NULL,
    reward_type TEXT NOT NULL DEFAULT 'badge',
    reward_metadata_json TEXT NOT NULL DEFAULT '{}',
    reward_slots INTEGER NOT NULL DEFAULT 1,
    minimum_score TEXT NOT NULL DEFAULT '0',
    reward_amount_usdc TEXT,
    reward_amount_atomic TEXT,
    reward_mint TEXT,
    reward_asset TEXT,
    funding_status TEXT NOT NULL DEFAULT 'not_required',
    funding_asset TEXT,
    funding_amount_display TEXT,
    funding_amount_atomic TEXT,
    funding_vault_wallet TEXT,
    funded_at TEXT,
    access_type TEXT NOT NULL DEFAULT 'invite_only',
    status TEXT NOT NULL DEFAULT 'draft',
    version TEXT NOT NULL DEFAULT '1',
    published_at TEXT,
    closes_at TEXT,
    deleted_at TEXT,
    deleted_by_user_id TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS challenge_invitations (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    target_wallet TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    accepted_by_user_id TEXT REFERENCES users(id),
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS participations (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    student_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'accepted',
    joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    participation_id TEXT NOT NULL REFERENCES participations(id) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'draft',
    reflection TEXT NOT NULL DEFAULT '',
    evidence_json TEXT NOT NULL DEFAULT '[]',
    submitted_at TEXT,
    locked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS submission_files (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    r2_key TEXT NOT NULL,
    original_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS evidence_chunks (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    file_id TEXT NOT NULL REFERENCES submission_files(id) ON DELETE CASCADE,
    file_hash TEXT NOT NULL,
    locator TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_estimate INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    assessment_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_review',
    ai_result_hash TEXT NOT NULL,
    assessment_mode TEXT NOT NULL DEFAULT 'ai_assisted',
    cache_key TEXT,
    input_token_estimate INTEGER,
    output_token_estimate INTEGER,
    final_result_hash TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    reviewer_user_id TEXT NOT NULL REFERENCES users(id),
    decision TEXT NOT NULL,
    review_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS credential_issuers (
    organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    credential_name TEXT NOT NULL,
    credential_address TEXT NOT NULL,
    schema_name TEXT NOT NULL,
    schema_address TEXT NOT NULL,
    authorized_signer_address TEXT NOT NULL,
    bootstrap_tx TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS skill_credentials (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL REFERENCES assessments(id),
    challenge_id TEXT NOT NULL REFERENCES challenges(id),
    student_user_id TEXT NOT NULL REFERENCES users(id),
    student_wallet TEXT NOT NULL,
    issuer_organization_id TEXT NOT NULL REFERENCES organizations(id),
    nonce_address TEXT NOT NULL,
    attestation_address TEXT NOT NULL,
    schema_address TEXT NOT NULL,
    score TEXT NOT NULL,
    skills_json TEXT NOT NULL DEFAULT '[]',
    evidence_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'issuing',
    issue_tx TEXT,
    revoke_tx TEXT,
    expires_at TEXT NOT NULL,
    issued_at TEXT,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    required_issuer_organization_id TEXT NOT NULL REFERENCES organizations(id),
    minimum_score TEXT NOT NULL DEFAULT '0',
    policy_address TEXT,
    policy_tx TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS access_grants (
    id TEXT PRIMARY KEY,
    opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    credential_id TEXT REFERENCES skill_credentials(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    wallet_address TEXT NOT NULL,
    decision TEXT NOT NULL,
    reason TEXT NOT NULL,
    verification_json TEXT NOT NULL,
    receipt_address TEXT,
    record_tx TEXT,
    verification_digest TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    creator_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    client_email TEXT,
    description TEXT NOT NULL,
    amount_usdc TEXT NOT NULL,
    amount_atomic TEXT NOT NULL,
    fiat_currency TEXT NOT NULL DEFAULT 'USD',
    fiat_amount TEXT NOT NULL,
    fx_rate_vnd TEXT,
    fx_rate_source TEXT,
    fx_captured_at TEXT,
    recipient_wallet TEXT NOT NULL,
    payment_reference TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    due_at TEXT,
    paid_atomic TEXT NOT NULL DEFAULT '0',
    paid_at TEXT,
    paid_tx TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS payment_events (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    signature TEXT NOT NULL,
    sender_wallet TEXT,
    recipient_wallet TEXT NOT NULL,
    amount_atomic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    observed_at TEXT NOT NULL,
    raw_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS challenge_payouts (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_wallet TEXT NOT NULL,
    amount_usdc TEXT NOT NULL,
    amount_atomic TEXT NOT NULL,
    asset TEXT NOT NULL DEFAULT 'usdc',
    status TEXT NOT NULL DEFAULT 'pending',
    payment_tx TEXT,
    paid_at TEXT,
    verified_by_user_id TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS challenge_funds (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL UNIQUE REFERENCES challenges(id) ON DELETE CASCADE,
    asset TEXT NOT NULL,
    required_display TEXT NOT NULL,
    required_atomic TEXT NOT NULL,
    funded_atomic TEXT NOT NULL DEFAULT '0',
    disbursed_atomic TEXT NOT NULL DEFAULT '0',
    refunded_atomic TEXT NOT NULL DEFAULT '0',
    vault_wallet TEXT NOT NULL,
    reference_key TEXT NOT NULL UNIQUE,
    sender_wallet TEXT,
    status TEXT NOT NULL DEFAULT 'awaiting_payment',
    funding_tx TEXT UNIQUE,
    submitted_tx TEXT,
    verification_state TEXT NOT NULL DEFAULT 'awaiting_signature',
    last_verification_error_code TEXT,
    verification_checked_at TEXT,
    verification_attempts INTEGER NOT NULL DEFAULT 0,
    terms_version TEXT,
    terms_hash TEXT,
    terms_signature TEXT,
    terms_signer_wallet TEXT,
    terms_accepted_at TEXT,
    locked_at TEXT,
    refund_policy_state TEXT NOT NULL DEFAULT 'pre_publish',
    funded_at TEXT,
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS challenge_funding_events (
    id TEXT PRIMARY KEY,
    challenge_fund_id TEXT NOT NULL REFERENCES challenge_funds(id) ON DELETE CASCADE,
    signature TEXT NOT NULL UNIQUE,
    sender_wallet TEXT,
    recipient_wallet TEXT NOT NULL,
    amount_atomic TEXT NOT NULL,
    asset TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    raw_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS challenge_refunds (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL UNIQUE REFERENCES challenges(id) ON DELETE CASCADE,
    challenge_fund_id TEXT NOT NULL REFERENCES challenge_funds(id) ON DELETE CASCADE,
    recipient_wallet TEXT NOT NULL,
    asset TEXT NOT NULL,
    amount_atomic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_tx TEXT UNIQUE,
    requested_by_user_id TEXT NOT NULL REFERENCES users(id),
    refunded_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS cashout_beneficiaries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_beneficiary_id TEXT NOT NULL UNIQUE,
    bank_code TEXT NOT NULL,
    bank_bin TEXT,
    bank_name TEXT,
    account_last4 TEXT NOT NULL,
    account_holder_masked TEXT NOT NULL,
    payout_method TEXT NOT NULL DEFAULT 'bank',
    payout_provider TEXT NOT NULL DEFAULT 'sandbox',
    verification_state TEXT NOT NULL DEFAULT 'sandbox_verified',
    verification_provider TEXT NOT NULL DEFAULT 'sandbox_directory',
    verification_reference TEXT,
    verified_at TEXT,
    status TEXT NOT NULL DEFAULT 'sandbox_verified',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS cashout_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    beneficiary_id TEXT REFERENCES cashout_beneficiaries(id),
    wallet_address TEXT NOT NULL,
    amount_usdc TEXT NOT NULL,
    amount_atomic TEXT NOT NULL,
    estimated_vnd TEXT NOT NULL,
    fee_vnd TEXT NOT NULL,
    net_vnd TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'skillbridge_sandbox',
    payout_method TEXT NOT NULL DEFAULT 'bank',
    payout_provider TEXT NOT NULL DEFAULT 'sandbox',
    execution_mode TEXT NOT NULL DEFAULT 'devnet_sandbox',
    payout_status TEXT NOT NULL DEFAULT 'not_started',
    status TEXT NOT NULL DEFAULT 'quote_ready',
    provider_reference TEXT NOT NULL,
    rate_vnd TEXT,
    provider_fee_vnd TEXT,
    network_fee_vnd TEXT,
    quote_expires_at TEXT,
    rate_source TEXT NOT NULL DEFAULT 'configured_test_rate',
    quote_id TEXT,
    reference_rate_vnd TEXT,
    usdc_usd_rate TEXT,
    usd_vnd_rate TEXT,
    reference_updated_at TEXT,
    reference_freshness TEXT,
    spread_bps TEXT,
    quote_payload_hash TEXT,
    settlement_wallet TEXT,
    reference_key TEXT UNIQUE,
    submitted_tx TEXT,
    payment_tx TEXT UNIQUE,
    payment_observed_at TEXT,
    verification_state TEXT NOT NULL DEFAULT 'awaiting_signature',
    last_error_code TEXT,
    bank_reference TEXT,
    terms_accepted_at TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS fx_rate_snapshots (
    id TEXT PRIMARY KEY,
    cashout_session_id TEXT REFERENCES cashout_sessions(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    pair TEXT NOT NULL,
    rate TEXT NOT NULL,
    source_updated_at TEXT NOT NULL,
    freshness TEXT NOT NULL,
    confidence TEXT,
    payload_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS cashout_events (
    id TEXT PRIMARY KEY,
    cashout_session_id TEXT NOT NULL REFERENCES cashout_sessions(id) ON DELETE CASCADE,
    event_key TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS cashout_webhook_events (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_event_id TEXT NOT NULL UNIQUE,
    signature_valid INTEGER NOT NULL DEFAULT 0,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received',
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS talent_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    headline TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'private',
    availability TEXT NOT NULL DEFAULT 'available',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS external_attestations (
    id TEXT PRIMARY KEY,
    recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issuer_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    evidence_hash TEXT,
    attestation_address TEXT,
    issue_tx TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    created_by_user_id TEXT NOT NULL REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS freelance_contracts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    freelancer_user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    total_amount_usdc TEXT NOT NULL,
    total_amount_atomic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed',
    settlement_mode TEXT NOT NULL DEFAULT 'direct_devnet',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS contract_milestones (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES freelance_contracts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    amount_usdc TEXT NOT NULL,
    amount_atomic TEXT NOT NULL,
    position INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    submission_note TEXT,
    payment_tx TEXT,
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT REFERENCES users(id),
    organization_id TEXT REFERENCES organizations(id),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    bucket_start TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_nonces_nonce ON auth_nonces(nonce)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_nonces_wallet_expires ON auth_nonces(wallet_address, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_org_user_role ON memberships(organization_id, user_id, role)`,
  `CREATE INDEX IF NOT EXISTS idx_memberships_user_status ON memberships(user_id, status)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_invitations_org_expires ON invitations(organization_id, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_challenges_org_status ON challenges(organization_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_challenges_status_closes ON challenges(status, closes_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_invitations_token_hash ON challenge_invitations(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_challenge_invitations_challenge_status ON challenge_invitations(challenge_id, status)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_participations_challenge_student ON participations(challenge_id, student_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_participations_student_state ON participations(student_user_id, state)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_participation ON submissions(participation_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_submission_files_r2_key ON submission_files(r2_key)`,
  `CREATE INDEX IF NOT EXISTS idx_submission_files_submission ON submission_files(submission_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_chunks_file_ordinal ON evidence_chunks(file_id, ordinal)`,
  `CREATE INDEX IF NOT EXISTS idx_evidence_chunks_submission_hash ON evidence_chunks(submission_id, file_hash)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_assessments_submission ON assessments(submission_id)`,
  `CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_assessment_created ON reviews(assessment_id, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_credentials_assessment ON skill_credentials(assessment_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_credentials_attestation ON skill_credentials(attestation_address)`,
  `CREATE INDEX IF NOT EXISTS idx_skill_credentials_wallet_status ON skill_credentials(student_wallet, status)`,
  `CREATE INDEX IF NOT EXISTS idx_opportunities_org_status ON opportunities(organization_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_access_grants_opportunity_wallet ON access_grants(opportunity_id, wallet_address)`,
  `CREATE INDEX IF NOT EXISTS idx_access_grants_user_created ON access_grants(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_creator_status ON invoices(creator_user_id, status)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_payment_reference ON invoices(payment_reference)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_signature ON payment_events(signature)`,
  `CREATE INDEX IF NOT EXISTS idx_payment_events_invoice_created ON payment_events(invoice_id, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_payouts_submission ON challenge_payouts(submission_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_payouts_tx ON challenge_payouts(payment_tx)`,
  `CREATE INDEX IF NOT EXISTS idx_challenge_payouts_recipient_status ON challenge_payouts(recipient_user_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_challenge_funds_challenge_status ON challenge_funds(challenge_id, status)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_funding_events_signature ON challenge_funding_events(signature)`,
  `CREATE INDEX IF NOT EXISTS idx_challenge_refunds_challenge_status ON challenge_refunds(challenge_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_cashout_beneficiaries_user_created ON cashout_beneficiaries(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_cashout_sessions_user_created ON cashout_sessions(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_cashout_events_session_created ON cashout_events(cashout_session_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_fx_rate_snapshots_cashout_created ON fx_rate_snapshots(cashout_session_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_talent_profiles_visibility ON talent_profiles(visibility, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_external_attestations_recipient ON external_attestations(recipient_user_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_contracts_org_status ON freelance_contracts(organization_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_contract_milestones_contract ON contract_milestones(contract_id, position)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_actor_created ON audit_events(actor_user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_target_created ON audit_events(target_type, target_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_rate_limits_expiry ON rate_limits(expires_at)`,
] as const;

let initialized = false;

export async function ensureCoreSchema(db: D1Database) {
  if (initialized) return;
  await db.batch(statements.map((statement) => db.prepare(statement)));
  await db.batch(ESCROW_TRIGGERS.map((statement) => db.prepare(statement)));
  const challengeColumns = await db
    .prepare("PRAGMA table_info(challenges)")
    .all<{ name: string }>();
  if (
    !challengeColumns.results.some((column) => column.name === "access_type")
  ) {
    try {
      await db
        .prepare(
          "ALTER TABLE challenges ADD COLUMN access_type TEXT NOT NULL DEFAULT 'invite_only'",
        )
        .run();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.toLowerCase().includes("duplicate column")
      )
        throw error;
    }
  }
  for (const column of [
    "reward_amount_usdc",
    "reward_amount_atomic",
    "reward_mint",
  ]) {
    if (challengeColumns.results.some((item) => item.name === column)) continue;
    try {
      await db
        .prepare(`ALTER TABLE challenges ADD COLUMN ${column} TEXT`)
        .run();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.toLowerCase().includes("duplicate column")
      )
        throw error;
    }
  }
  for (const definition of [
    ["content_json", "TEXT NOT NULL DEFAULT '{}'"],
    ["reward_type", "TEXT NOT NULL DEFAULT 'badge'"],
    ["reward_metadata_json", "TEXT NOT NULL DEFAULT '{}'"],
    ["reward_slots", "INTEGER NOT NULL DEFAULT 1"],
    ["minimum_score", "TEXT NOT NULL DEFAULT '0'"],
    ["reward_asset", "TEXT"],
    ["funding_status", "TEXT NOT NULL DEFAULT 'not_required'"],
    ["funding_asset", "TEXT"],
    ["funding_amount_display", "TEXT"],
    ["funding_amount_atomic", "TEXT"],
    ["funding_vault_wallet", "TEXT"],
    ["funded_at", "TEXT"],
    ["deleted_at", "TEXT"],
    ["deleted_by_user_id", "TEXT"],
  ] as const) {
    if (
      challengeColumns.results.some((column) => column.name === definition[0])
    )
      continue;
    try {
      await db
        .prepare(
          `ALTER TABLE challenges ADD COLUMN ${definition[0]} ${definition[1]}`,
        )
        .run();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.toLowerCase().includes("duplicate column")
      )
        throw error;
    }
  }
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_challenges_deleted_at ON challenges(deleted_at)",
    )
    .run();
  await db
    .prepare(
      "UPDATE challenges SET reward_type = 'usdc' WHERE reward_type = 'badge' AND reward_amount_atomic IS NOT NULL",
    )
    .run();
  await db
    .prepare(
      "UPDATE challenges SET reward_asset = reward_type WHERE reward_asset IS NULL AND reward_type IN ('usdc', 'sol')",
    )
    .run();
  const payoutColumns = await db
    .prepare("PRAGMA table_info(challenge_payouts)")
    .all<{ name: string }>();
  if (!payoutColumns.results.some((column) => column.name === "asset")) {
    try {
      await db
        .prepare(
          "ALTER TABLE challenge_payouts ADD COLUMN asset TEXT NOT NULL DEFAULT 'usdc'",
        )
        .run();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.toLowerCase().includes("duplicate column")
      )
        throw error;
    }
  }
  const fundingColumns = await db
    .prepare("PRAGMA table_info(challenge_funds)")
    .all<{ name: string }>();
  for (const definition of [
    ["submitted_tx", "TEXT"],
    ["verification_state", "TEXT NOT NULL DEFAULT 'awaiting_signature'"],
    ["last_verification_error_code", "TEXT"],
    ["verification_checked_at", "TEXT"],
    ["verification_attempts", "INTEGER NOT NULL DEFAULT 0"],
    ["terms_version", "TEXT"],
    ["terms_hash", "TEXT"],
    ["terms_signature", "TEXT"],
    ["terms_signer_wallet", "TEXT"],
    ["terms_accepted_at", "TEXT"],
    ["locked_at", "TEXT"],
    ["refund_policy_state", "TEXT NOT NULL DEFAULT 'pre_publish'"],
  ] as const) {
    if (fundingColumns.results.some((column) => column.name === definition[0]))
      continue;
    try {
      await db
        .prepare(
          `ALTER TABLE challenge_funds ADD COLUMN ${definition[0]} ${definition[1]}`,
        )
        .run();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.toLowerCase().includes("duplicate column")
      )
        throw error;
    }
  }
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_challenge_funds_submitted_tx ON challenge_funds(submitted_tx)",
    )
    .run();
  const beneficiaryColumns = await db
    .prepare("PRAGMA table_info(cashout_beneficiaries)")
    .all<{ name: string }>();
  for (const definition of [
    ["payout_method", "TEXT NOT NULL DEFAULT 'bank'"],
    ["payout_provider", "TEXT NOT NULL DEFAULT 'sandbox'"],
    ["verification_state", "TEXT NOT NULL DEFAULT 'sandbox_verified'"],
    ["bank_bin", "TEXT"],
    ["bank_name", "TEXT"],
    ["verification_provider", "TEXT NOT NULL DEFAULT 'sandbox_directory'"],
    ["verification_reference", "TEXT"],
    ["verified_at", "TEXT"],
  ] as const) {
    if (
      beneficiaryColumns.results.some((column) => column.name === definition[0])
    )
      continue;
    try {
      await db
        .prepare(
          `ALTER TABLE cashout_beneficiaries ADD COLUMN ${definition[0]} ${definition[1]}`,
        )
        .run();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.toLowerCase().includes("duplicate column")
      )
        throw error;
    }
  }
  const cashoutColumns = await db
    .prepare("PRAGMA table_info(cashout_sessions)")
    .all<{ name: string }>();
  for (const definition of [
    ["beneficiary_id", "TEXT REFERENCES cashout_beneficiaries(id)"],
    ["payout_method", "TEXT NOT NULL DEFAULT 'bank'"],
    ["payout_provider", "TEXT NOT NULL DEFAULT 'sandbox'"],
    ["execution_mode", "TEXT NOT NULL DEFAULT 'devnet_sandbox'"],
    ["payout_status", "TEXT NOT NULL DEFAULT 'not_started'"],
    ["rate_vnd", "TEXT"],
    ["provider_fee_vnd", "TEXT"],
    ["network_fee_vnd", "TEXT"],
    ["quote_expires_at", "TEXT"],
    ["rate_source", "TEXT NOT NULL DEFAULT 'configured_test_rate'"],
    ["quote_id", "TEXT"],
    ["reference_rate_vnd", "TEXT"],
    ["usdc_usd_rate", "TEXT"],
    ["usd_vnd_rate", "TEXT"],
    ["reference_updated_at", "TEXT"],
    ["reference_freshness", "TEXT"],
    ["spread_bps", "TEXT"],
    ["quote_payload_hash", "TEXT"],
    ["settlement_wallet", "TEXT"],
    ["reference_key", "TEXT"],
    ["submitted_tx", "TEXT"],
    ["payment_tx", "TEXT"],
    ["payment_observed_at", "TEXT"],
    ["verification_state", "TEXT NOT NULL DEFAULT 'awaiting_signature'"],
    ["last_error_code", "TEXT"],
    ["bank_reference", "TEXT"],
    ["terms_accepted_at", "TEXT"],
    ["metadata_json", "TEXT NOT NULL DEFAULT '{}'"],
  ] as const) {
    if (cashoutColumns.results.some((column) => column.name === definition[0]))
      continue;
    try {
      await db
        .prepare(
          `ALTER TABLE cashout_sessions ADD COLUMN ${definition[0]} ${definition[1]}`,
        )
        .run();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.toLowerCase().includes("duplicate column")
      )
        throw error;
    }
  }
  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_cashout_sessions_reference ON cashout_sessions(reference_key)",
    )
    .run();
  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_cashout_sessions_payment_tx ON cashout_sessions(payment_tx)",
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_cashout_sessions_submitted_tx ON cashout_sessions(submitted_tx)",
    )
    .run();
  const assessmentColumns = await db
    .prepare("PRAGMA table_info(assessments)")
    .all<{ name: string }>();
  const credentialColumns = await db
    .prepare("PRAGMA table_info(skill_credentials)")
    .all<{ name: string }>();
  if (
    !credentialColumns.results.some((column) => column.name === "skills_json")
  ) {
    try {
      await db
        .prepare(
          "ALTER TABLE skill_credentials ADD COLUMN skills_json TEXT NOT NULL DEFAULT '[]'",
        )
        .run();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.toLowerCase().includes("duplicate column")
      )
        throw error;
    }
  }
  if (
    !assessmentColumns.results.some(
      (column) => column.name === "assessment_mode",
    )
  ) {
    try {
      await db
        .prepare(
          "ALTER TABLE assessments ADD COLUMN assessment_mode TEXT NOT NULL DEFAULT 'ai_assisted'",
        )
        .run();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.toLowerCase().includes("duplicate column")
      )
        throw error;
    }
  }
  for (const definition of [
    ["cache_key", "TEXT"],
    ["input_token_estimate", "INTEGER"],
    ["output_token_estimate", "INTEGER"],
  ] as const) {
    if (
      assessmentColumns.results.some((column) => column.name === definition[0])
    )
      continue;
    try {
      await db
        .prepare(
          `ALTER TABLE assessments ADD COLUMN ${definition[0]} ${definition[1]}`,
        )
        .run();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.toLowerCase().includes("duplicate column")
      )
        throw error;
    }
  }
  initialized = true;
}
