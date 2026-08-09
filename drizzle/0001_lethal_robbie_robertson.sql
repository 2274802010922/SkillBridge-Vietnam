CREATE TABLE `demo_assessments` (
	`run_id` text PRIMARY KEY NOT NULL,
	`assessment_json` text NOT NULL,
	`review_json` text,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `demo_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
