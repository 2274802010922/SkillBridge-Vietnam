import { sql } from "drizzle-orm";
import { index, integer, text, uniqueIndex, sqliteTable } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name"),
  profileKind: text("profile_kind").notNull().default("student"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const wallets = sqliteTable(
  "wallets",
  {
    address: text("address").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    chain: text("chain").notNull().default("solana:devnet"),
    verifiedAt: text("verified_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastSignedInAt: text("last_signed_in_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_wallets_user_id").on(table.userId)],
);

export const authNonces = sqliteTable(
  "auth_nonces",
  {
    id: text("id").primaryKey(),
    nonce: text("nonce").notNull(),
    walletAddress: text("wallet_address").notNull(),
    domain: text("domain").notNull(),
    uri: text("uri").notNull(),
    chainId: text("chain_id").notNull(),
    statement: text("statement").notNull(),
    requestId: text("request_id").notNull(),
    issuedAt: text("issued_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_auth_nonces_nonce").on(table.nonce),
    index("idx_auth_nonces_wallet_expires").on(table.walletAddress, table.expiresAt),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_sessions_token_hash").on(table.tokenHash),
    index("idx_sessions_user_expires").on(table.userId, table.expiresAt),
  ],
);

export const organizations = sqliteTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    description: text("description"),
    website: text("website"),
    verificationStatus: text("verification_status").notNull().default("unverified"),
    createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_organizations_slug").on(table.slug)],
);

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_memberships_org_user_role").on(table.organizationId, table.userId, table.role),
    index("idx_memberships_user_status").on(table.userId, table.status),
  ],
);

export const invitations = sqliteTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    targetWallet: text("target_wallet"),
    createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
    expiresAt: text("expires_at").notNull(),
    acceptedAt: text("accepted_at"),
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_invitations_token_hash").on(table.tokenHash),
    index("idx_invitations_org_expires").on(table.organizationId, table.expiresAt),
  ],
);

export const challenges = sqliteTable(
  "challenges",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    reviewerOrganizationId: text("reviewer_organization_id").references(() => organizations.id),
    createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    brief: text("brief").notNull(),
    skillsJson: text("skills_json").notNull().default("[]"),
    rubricJson: text("rubric_json").notNull(),
    reward: text("reward").notNull(),
    rewardAmountUsdc: text("reward_amount_usdc"),
    rewardAmountAtomic: text("reward_amount_atomic"),
    rewardMint: text("reward_mint"),
    accessType: text("access_type").notNull().default("invite_only"),
    status: text("status").notNull().default("draft"),
    version: text("version").notNull().default("1"),
    publishedAt: text("published_at"),
    closesAt: text("closes_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_challenges_org_status").on(table.organizationId, table.status),
    index("idx_challenges_status_closes").on(table.status, table.closesAt),
  ],
);

export const challengeInvitations = sqliteTable(
  "challenge_invitations",
  {
    id: text("id").primaryKey(),
    challengeId: text("challenge_id").notNull().references(() => challenges.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    targetWallet: text("target_wallet"),
    status: text("status").notNull().default("active"),
    expiresAt: text("expires_at").notNull(),
    acceptedAt: text("accepted_at"),
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id),
    createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_challenge_invitations_token_hash").on(table.tokenHash),
    index("idx_challenge_invitations_challenge_status").on(table.challengeId, table.status),
  ],
);

export const participations = sqliteTable(
  "participations",
  {
    id: text("id").primaryKey(),
    challengeId: text("challenge_id").notNull().references(() => challenges.id, { onDelete: "cascade" }),
    studentUserId: text("student_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    state: text("state").notNull().default("accepted"),
    joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_participations_challenge_student").on(table.challengeId, table.studentUserId),
    index("idx_participations_student_state").on(table.studentUserId, table.state),
  ],
);

export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    participationId: text("participation_id").notNull().references(() => participations.id, { onDelete: "cascade" }),
    state: text("state").notNull().default("draft"),
    reflection: text("reflection").notNull().default(""),
    evidenceJson: text("evidence_json").notNull().default("[]"),
    submittedAt: text("submitted_at"),
    lockedAt: text("locked_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_submissions_participation").on(table.participationId)],
);

export const submissionFiles = sqliteTable(
  "submission_files",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: text("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    uploadedByUserId: text("uploaded_by_user_id").notNull().references(() => users.id),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_submission_files_r2_key").on(table.r2Key),
    index("idx_submission_files_submission").on(table.submissionId),
  ],
);

export const assessments = sqliteTable(
  "assessments",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    schemaVersion: text("schema_version").notNull(),
    assessmentJson: text("assessment_json").notNull(),
    status: text("status").notNull().default("in_review"),
    aiResultHash: text("ai_result_hash").notNull(),
    assessmentMode: text("assessment_mode").notNull().default("ai_assisted"),
    finalResultHash: text("final_result_hash"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_assessments_submission").on(table.submissionId),
    index("idx_assessments_status").on(table.status),
  ],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    assessmentId: text("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
    reviewerUserId: text("reviewer_user_id").notNull().references(() => users.id),
    decision: text("decision").notNull(),
    reviewJson: text("review_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_reviews_assessment_created").on(table.assessmentId, table.createdAt)],
);

export const credentialIssuers = sqliteTable("credential_issuers", {
  organizationId: text("organization_id").primaryKey().references(() => organizations.id, { onDelete: "cascade" }),
  credentialName: text("credential_name").notNull(),
  credentialAddress: text("credential_address").notNull(),
  schemaName: text("schema_name").notNull(),
  schemaAddress: text("schema_address").notNull(),
  authorizedSignerAddress: text("authorized_signer_address").notNull(),
  bootstrapTx: text("bootstrap_tx").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const skillCredentials = sqliteTable(
  "skill_credentials",
  {
    id: text("id").primaryKey(),
    assessmentId: text("assessment_id").notNull().references(() => assessments.id),
    challengeId: text("challenge_id").notNull().references(() => challenges.id),
    studentUserId: text("student_user_id").notNull().references(() => users.id),
    studentWallet: text("student_wallet").notNull(),
    issuerOrganizationId: text("issuer_organization_id").notNull().references(() => organizations.id),
    nonceAddress: text("nonce_address").notNull(),
    attestationAddress: text("attestation_address").notNull(),
    schemaAddress: text("schema_address").notNull(),
    score: text("score").notNull(),
    evidenceHash: text("evidence_hash").notNull(),
    status: text("status").notNull().default("issuing"),
    issueTx: text("issue_tx"),
    revokeTx: text("revoke_tx"),
    expiresAt: text("expires_at").notNull(),
    issuedAt: text("issued_at"),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_skill_credentials_assessment").on(table.assessmentId),
    uniqueIndex("idx_skill_credentials_attestation").on(table.attestationAddress),
    index("idx_skill_credentials_wallet_status").on(table.studentWallet, table.status),
  ],
);

export const opportunities = sqliteTable(
  "opportunities",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    requiredIssuerOrganizationId: text("required_issuer_organization_id").notNull().references(() => organizations.id),
    minimumScore: text("minimum_score").notNull().default("0"),
    policyAddress: text("policy_address"),
    policyTx: text("policy_tx"),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_opportunities_org_status").on(table.organizationId, table.status)],
);

export const accessGrants = sqliteTable(
  "access_grants",
  {
    id: text("id").primaryKey(),
    opportunityId: text("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").references(() => skillCredentials.id),
    userId: text("user_id").notNull().references(() => users.id),
    walletAddress: text("wallet_address").notNull(),
    decision: text("decision").notNull(),
    reason: text("reason").notNull(),
    verificationJson: text("verification_json").notNull(),
    receiptAddress: text("receipt_address"),
    recordTx: text("record_tx"),
    verificationDigest: text("verification_digest"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_access_grants_opportunity_wallet").on(table.opportunityId, table.walletAddress),
    index("idx_access_grants_user_created").on(table.userId, table.createdAt),
  ],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    creatorUserId: text("creator_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email"),
    description: text("description").notNull(),
    amountUsdc: text("amount_usdc").notNull(),
    amountAtomic: text("amount_atomic").notNull(),
    fiatCurrency: text("fiat_currency").notNull().default("USD"),
    fiatAmount: text("fiat_amount").notNull(),
    fxRateVnd: text("fx_rate_vnd"),
    fxRateSource: text("fx_rate_source"),
    fxCapturedAt: text("fx_captured_at"),
    recipientWallet: text("recipient_wallet").notNull(),
    paymentReference: text("payment_reference").notNull(),
    status: text("status").notNull().default("sent"),
    dueAt: text("due_at"),
    paidAtomic: text("paid_atomic").notNull().default("0"),
    paidAt: text("paid_at"),
    paidTx: text("paid_tx"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_invoices_creator_status").on(table.creatorUserId, table.status),
    uniqueIndex("idx_invoices_payment_reference").on(table.paymentReference),
  ],
);

export const paymentEvents = sqliteTable(
  "payment_events",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
    signature: text("signature").notNull(),
    senderWallet: text("sender_wallet"),
    recipientWallet: text("recipient_wallet").notNull(),
    amountAtomic: text("amount_atomic").notNull(),
    status: text("status").notNull().default("confirmed"),
    observedAt: text("observed_at").notNull(),
    rawJson: text("raw_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_payment_events_signature").on(table.signature),
    index("idx_payment_events_invoice_created").on(table.invoiceId, table.createdAt),
  ],
);

export const challengePayouts = sqliteTable(
  "challenge_payouts",
  {
    id: text("id").primaryKey(),
    challengeId: text("challenge_id").notNull().references(() => challenges.id, { onDelete: "cascade" }),
    submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
    recipientUserId: text("recipient_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    recipientWallet: text("recipient_wallet").notNull(),
    amountUsdc: text("amount_usdc").notNull(),
    amountAtomic: text("amount_atomic").notNull(),
    status: text("status").notNull().default("pending"),
    paymentTx: text("payment_tx"),
    paidAt: text("paid_at"),
    verifiedByUserId: text("verified_by_user_id").references(() => users.id),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_challenge_payouts_submission").on(table.submissionId),
    uniqueIndex("idx_challenge_payouts_tx").on(table.paymentTx),
    index("idx_challenge_payouts_recipient_status").on(table.recipientUserId, table.status),
  ],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => users.id),
    organizationId: text("organization_id").references(() => organizations.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    requestId: text("request_id").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_audit_actor_created").on(table.actorUserId, table.createdAt),
    index("idx_audit_target_created").on(table.targetType, table.targetId, table.createdAt),
  ],
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    scope: text("scope").notNull(),
    bucketStart: text("bucket_start").notNull(),
    count: integer("count").notNull().default(1),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [index("idx_rate_limits_expiry").on(table.expiresAt)],
);

export const demoRuns = sqliteTable("demo_runs", {
  id: text("id").primaryKey(),
  stage: text("stage").notNull().default("invited"),
  eventsJson: text("events_json").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const demoAssessments = sqliteTable("demo_assessments", {
  runId: text("run_id")
    .primaryKey()
    .references(() => demoRuns.id, { onDelete: "cascade" }),
  assessmentJson: text("assessment_json").notNull(),
  reviewJson: text("review_json"),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const roleWorkspaces = sqliteTable("role_workspaces", {
  id: text("id").primaryKey(),
  stage: text("stage").notNull().default("draft"),
  challengeJson: text("challenge_json").notNull(),
  participantJson: text("participant_json"),
  submissionJson: text("submission_json"),
  credentialJson: text("credential_json"),
  opportunityJson: text("opportunity_json").notNull(),
  eventsJson: text("events_json").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const workspaceAssessments = sqliteTable("workspace_assessments", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => roleWorkspaces.id, { onDelete: "cascade" }),
  assessmentJson: text("assessment_json").notNull(),
  reviewJson: text("review_json"),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
