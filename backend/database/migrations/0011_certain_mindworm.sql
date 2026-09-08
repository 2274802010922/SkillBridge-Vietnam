CREATE TABLE `challenge_payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`recipient_user_id` text NOT NULL,
	`recipient_wallet` text NOT NULL,
	`amount_usdc` text NOT NULL,
	`amount_atomic` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_tx` text,
	`paid_at` text,
	`verified_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verified_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_challenge_payouts_submission` ON `challenge_payouts` (`submission_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_challenge_payouts_tx` ON `challenge_payouts` (`payment_tx`);--> statement-breakpoint
CREATE INDEX `idx_challenge_payouts_recipient_status` ON `challenge_payouts` (`recipient_user_id`,`status`);--> statement-breakpoint
ALTER TABLE `challenges` ADD `reward_amount_usdc` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `reward_amount_atomic` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `reward_mint` text;