import { sql } from "drizzle-orm";
import { text, sqliteTable } from "drizzle-orm/sqlite-core";

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
