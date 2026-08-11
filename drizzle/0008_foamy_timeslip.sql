CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`organization_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`request_id` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_actor_created` ON `audit_events` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_target_created` ON `audit_events` (`target_type`,`target_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`bucket_start` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_expiry` ON `rate_limits` (`expires_at`);