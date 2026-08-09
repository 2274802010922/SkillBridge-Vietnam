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
