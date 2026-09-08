CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_user_id` text NOT NULL,
	`client_name` text NOT NULL,
	`client_email` text,
	`description` text NOT NULL,
	`amount_usdc` text NOT NULL,
	`amount_atomic` text NOT NULL,
	`fiat_currency` text DEFAULT 'USD' NOT NULL,
	`fiat_amount` text NOT NULL,
	`fx_rate_vnd` text,
	`fx_rate_source` text,
	`fx_captured_at` text,
	`recipient_wallet` text NOT NULL,
	`payment_reference` text NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`due_at` text,
	`paid_atomic` text DEFAULT '0' NOT NULL,
	`paid_at` text,
	`paid_tx` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`creator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_invoices_creator_status` ON `invoices` (`creator_user_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invoices_payment_reference` ON `invoices` (`payment_reference`);--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`signature` text NOT NULL,
	`sender_wallet` text,
	`recipient_wallet` text NOT NULL,
	`amount_atomic` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`observed_at` text NOT NULL,
	`raw_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payment_events_signature` ON `payment_events` (`signature`);--> statement-breakpoint
CREATE INDEX `idx_payment_events_invoice_created` ON `payment_events` (`invoice_id`,`created_at`);