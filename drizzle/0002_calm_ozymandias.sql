CREATE TABLE `role_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`stage` text DEFAULT 'draft' NOT NULL,
	`challenge_json` text NOT NULL,
	`participant_json` text,
	`submission_json` text,
	`credential_json` text,
	`opportunity_json` text NOT NULL,
	`events_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace_assessments` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`assessment_json` text NOT NULL,
	`review_json` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `role_workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
