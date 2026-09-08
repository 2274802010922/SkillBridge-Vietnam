CREATE TABLE `demo_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`stage` text DEFAULT 'invited' NOT NULL,
	`events_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
