CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`schema_version` text NOT NULL,
	`assessment_json` text NOT NULL,
	`status` text DEFAULT 'in_review' NOT NULL,
	`ai_result_hash` text NOT NULL,
	`final_result_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_assessments_submission` ON `assessments` (`submission_id`);--> statement-breakpoint
CREATE INDEX `idx_assessments_status` ON `assessments` (`status`);--> statement-breakpoint
CREATE TABLE `challenge_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`target_wallet` text,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`accepted_by_user_id` text,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accepted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_challenge_invitations_token_hash` ON `challenge_invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_challenge_invitations_challenge_status` ON `challenge_invitations` (`challenge_id`,`status`);--> statement-breakpoint
CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`reviewer_organization_id` text,
	`created_by_user_id` text NOT NULL,
	`title` text NOT NULL,
	`brief` text NOT NULL,
	`skills_json` text DEFAULT '[]' NOT NULL,
	`rubric_json` text NOT NULL,
	`reward` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` text DEFAULT '1' NOT NULL,
	`published_at` text,
	`closes_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_challenges_org_status` ON `challenges` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_challenges_status_closes` ON `challenges` (`status`,`closes_at`);--> statement-breakpoint
CREATE TABLE `participations` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`student_user_id` text NOT NULL,
	`state` text DEFAULT 'accepted' NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_participations_challenge_student` ON `participations` (`challenge_id`,`student_user_id`);--> statement-breakpoint
CREATE INDEX `idx_participations_student_state` ON `participations` (`student_user_id`,`state`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`reviewer_user_id` text NOT NULL,
	`decision` text NOT NULL,
	`review_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_assessment_created` ON `reviews` (`assessment_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `submission_files` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`original_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` text NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_submission_files_r2_key` ON `submission_files` (`r2_key`);--> statement-breakpoint
CREATE INDEX `idx_submission_files_submission` ON `submission_files` (`submission_id`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`participation_id` text NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`reflection` text DEFAULT '' NOT NULL,
	`evidence_json` text DEFAULT '[]' NOT NULL,
	`submitted_at` text,
	`locked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`participation_id`) REFERENCES `participations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_submissions_participation` ON `submissions` (`participation_id`);