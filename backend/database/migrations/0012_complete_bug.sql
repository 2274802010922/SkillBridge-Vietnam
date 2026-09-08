CREATE TABLE `cashout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`wallet_address` text NOT NULL,
	`amount_usdc` text NOT NULL,
	`amount_atomic` text NOT NULL,
	`estimated_vnd` text NOT NULL,
	`fee_vnd` text NOT NULL,
	`net_vnd` text NOT NULL,
	`provider` text DEFAULT 'skillbridge_sandbox' NOT NULL,
	`status` text DEFAULT 'quote_ready' NOT NULL,
	`provider_reference` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cashout_sessions_user_created` ON `cashout_sessions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `challenge_funding_events` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_fund_id` text NOT NULL,
	`signature` text NOT NULL,
	`sender_wallet` text,
	`recipient_wallet` text NOT NULL,
	`amount_atomic` text NOT NULL,
	`asset` text NOT NULL,
	`observed_at` text NOT NULL,
	`raw_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`challenge_fund_id`) REFERENCES `challenge_funds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_funding_events_signature_unique` ON `challenge_funding_events` (`signature`);--> statement-breakpoint
CREATE INDEX `idx_challenge_funding_events_fund_created` ON `challenge_funding_events` (`challenge_fund_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `challenge_funds` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`asset` text NOT NULL,
	`required_display` text NOT NULL,
	`required_atomic` text NOT NULL,
	`funded_atomic` text DEFAULT '0' NOT NULL,
	`disbursed_atomic` text DEFAULT '0' NOT NULL,
	`refunded_atomic` text DEFAULT '0' NOT NULL,
	`vault_wallet` text NOT NULL,
	`reference_key` text NOT NULL,
	`sender_wallet` text,
	`status` text DEFAULT 'awaiting_payment' NOT NULL,
	`funding_tx` text,
	`funded_at` text,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_funds_challenge_id_unique` ON `challenge_funds` (`challenge_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_funds_reference_key_unique` ON `challenge_funds` (`reference_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_funds_funding_tx_unique` ON `challenge_funds` (`funding_tx`);--> statement-breakpoint
CREATE INDEX `idx_challenge_funds_challenge_status` ON `challenge_funds` (`challenge_id`,`status`);--> statement-breakpoint
CREATE TABLE `challenge_refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`challenge_fund_id` text NOT NULL,
	`recipient_wallet` text NOT NULL,
	`asset` text NOT NULL,
	`amount_atomic` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_tx` text,
	`requested_by_user_id` text NOT NULL,
	`refunded_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`challenge_fund_id`) REFERENCES `challenge_funds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_refunds_challenge_id_unique` ON `challenge_refunds` (`challenge_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_refunds_payment_tx_unique` ON `challenge_refunds` (`payment_tx`);--> statement-breakpoint
CREATE INDEX `idx_challenge_refunds_challenge_status` ON `challenge_refunds` (`challenge_id`,`status`);--> statement-breakpoint
CREATE TABLE `evidence_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`file_id` text NOT NULL,
	`file_hash` text NOT NULL,
	`locator` text NOT NULL,
	`ordinal` integer NOT NULL,
	`content` text NOT NULL,
	`token_estimate` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `submission_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_evidence_chunks_file_ordinal` ON `evidence_chunks` (`file_id`,`ordinal`);--> statement-breakpoint
CREATE INDEX `idx_evidence_chunks_submission_hash` ON `evidence_chunks` (`submission_id`,`file_hash`);--> statement-breakpoint
ALTER TABLE `assessments` ADD `assessment_mode` text DEFAULT 'ai_assisted' NOT NULL;--> statement-breakpoint
ALTER TABLE `assessments` ADD `cache_key` text;--> statement-breakpoint
ALTER TABLE `assessments` ADD `input_token_estimate` integer;--> statement-breakpoint
ALTER TABLE `assessments` ADD `output_token_estimate` integer;--> statement-breakpoint
ALTER TABLE `challenge_payouts` ADD `asset` text DEFAULT 'usdc' NOT NULL;--> statement-breakpoint
ALTER TABLE `challenges` ADD `reward_type` text DEFAULT 'badge' NOT NULL;--> statement-breakpoint
ALTER TABLE `challenges` ADD `reward_metadata_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `challenges` ADD `reward_slots` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `challenges` ADD `minimum_score` text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `challenges` ADD `reward_asset` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `funding_status` text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE `challenges` ADD `funding_asset` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `funding_amount_display` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `funding_amount_atomic` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `funding_vault_wallet` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `funded_at` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `asset` text DEFAULT 'usdc' NOT NULL;--> statement-breakpoint
ALTER TABLE `skill_credentials` ADD `skills_json` text DEFAULT '[]' NOT NULL;