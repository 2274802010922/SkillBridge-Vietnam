CREATE TABLE `credential_issuers` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`credential_name` text NOT NULL,
	`credential_address` text NOT NULL,
	`schema_name` text NOT NULL,
	`schema_address` text NOT NULL,
	`authorized_signer_address` text NOT NULL,
	`bootstrap_tx` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `skill_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`challenge_id` text NOT NULL,
	`student_user_id` text NOT NULL,
	`student_wallet` text NOT NULL,
	`issuer_organization_id` text NOT NULL,
	`nonce_address` text NOT NULL,
	`attestation_address` text NOT NULL,
	`schema_address` text NOT NULL,
	`score` text NOT NULL,
	`evidence_hash` text NOT NULL,
	`status` text DEFAULT 'issuing' NOT NULL,
	`issue_tx` text,
	`revoke_tx` text,
	`expires_at` text NOT NULL,
	`issued_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`issuer_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_skill_credentials_assessment` ON `skill_credentials` (`assessment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_skill_credentials_attestation` ON `skill_credentials` (`attestation_address`);--> statement-breakpoint
CREATE INDEX `idx_skill_credentials_wallet_status` ON `skill_credentials` (`student_wallet`,`status`);