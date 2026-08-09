import { sql } from "drizzle-orm";
import { text, sqliteTable } from "drizzle-orm/sqlite-core";

export const demoRuns = sqliteTable("demo_runs", {
  id: text("id").primaryKey(),
  stage: text("stage").notNull().default("invited"),
  eventsJson: text("events_json").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
