import { sqliteTable,text,integer,index,uniqueIndex,primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users, organizations, assessments, opportunities, skillCredentials } from "../schema";
// Foreign-key callbacks are resolved after the core schema has initialized.
const created=()=>text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);
export const opportunityApplications=sqliteTable("opportunity_applications",{
  id:text("id").primaryKey(),opportunityId:text("opportunity_id").notNull().references(()=>opportunities.id),
  userId:text("user_id").notNull().references(()=>users.id),credentialId:text("credential_id").notNull().references(()=>skillCredentials.id),
  walletAddress:text("wallet_address").notNull(),status:text("status").notNull().default("submitted"),profileJson:text("profile_json").notNull(),verificationJson:text("verification_json").notNull(),
  receiptAddress:text("receipt_address"),recordTx:text("record_tx"),submittedAt:text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),updatedAt:text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
},t=>[uniqueIndex("opportunity_applications_opportunity_id_user_id_unique").on(t.opportunityId,t.userId)]);
export const portfolioPacks=sqliteTable("portfolio_packs",{
  id:text("id").primaryKey(),ownerId:text("owner_id").notNull().references(()=>users.id),title:text("title").notNull(),
  currentVersion:integer("current_version").notNull().default(1),publishedVersion:integer("published_version"),
  createdAt:created(),updatedAt:text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const portfolioPackVersions=sqliteTable("portfolio_pack_versions",{
  packId:text("pack_id").notNull().references(()=>portfolioPacks.id),version:integer("version").notNull(),contentJson:text("content_json").notNull(),
  sourcesJson:text("sources_json").notNull(),contentHash:text("content_hash").notNull(),createdAt:created(),
},t=>[primaryKey({columns:[t.packId,t.version]})]);
export const evidencePublicationPermissions=sqliteTable("evidence_publication_permissions",{
  assessmentId:text("assessment_id").primaryKey().references(()=>assessments.id),allowed:integer("allowed").notNull().default(0),actorId:text("actor_id").notNull().references(()=>users.id),updatedAt:text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const portfolioGrants=sqliteTable("portfolio_grants",{
  id:text("id").primaryKey(),packId:text("pack_id").notNull().references(()=>portfolioPacks.id),version:integer("version").notNull(),applicationId:text("application_id").notNull().references(()=>opportunityApplications.id),organizationId:text("organization_id").notNull().references(()=>organizations.id),ownerId:text("owner_id").notNull().references(()=>users.id),expiresAt:text("expires_at").notNull(),revokedAt:text("revoked_at"),createdAt:created(),
},t=>[uniqueIndex("idx_active_portfolio_grant").on(t.applicationId,t.packId).where(sql`${t.revokedAt} IS NULL`)]);
export const applicationNotes=sqliteTable("application_notes",{
  id:text("id").primaryKey(),applicationId:text("application_id").notNull().references(()=>opportunityApplications.id),organizationId:text("organization_id").notNull().references(()=>organizations.id),actorId:text("actor_id").notNull().references(()=>users.id),body:text("body").notNull(),createdAt:created(),
});
export const applicationEvents=sqliteTable("application_events",{
  id:text("id").primaryKey(),applicationId:text("application_id").notNull().references(()=>opportunityApplications.id),organizationId:text("organization_id").notNull().references(()=>organizations.id),actorId:text("actor_id").notNull().references(()=>users.id),status:text("status").notNull(),createdAt:created(),
});
export const featureTrials=sqliteTable("feature_trials",{
  scopeId:text("scope_id").notNull(),feature:text("feature").notNull(),provenance:text("provenance").notNull(),expiresAt:text("expires_at").notNull(),createdAt:created(),
},t=>[primaryKey({columns:[t.scopeId,t.feature]})]);
export const careerOperations=sqliteTable("career_operations",{
  id:text("id").primaryKey(),ownerId:text("owner_id").notNull().references(()=>users.id),fingerprint:text("fingerprint").notNull(),packId:text("pack_id").notNull().references(()=>portfolioPacks.id),version:integer("version").notNull(),locale:text("locale").notNull(),status:text("status").notNull(),resultJson:text("result_json"),usageJson:text("usage_json"),lease:text("lease").notNull(),expiresAt:integer("expires_at").notNull(),budgetDay:text("budget_day").notNull(),createdAt:created(),
},t=>[uniqueIndex("career_operations_owner_id_fingerprint_unique").on(t.ownerId,t.fingerprint),index("idx_career_budget").on(t.ownerId,t.budgetDay,t.status)]);
