ALTER TABLE `challenge_funds` ADD COLUMN `submitted_tx` text;
ALTER TABLE `challenge_funds` ADD COLUMN `verification_state` text NOT NULL DEFAULT 'awaiting_signature';
ALTER TABLE `challenge_funds` ADD COLUMN `last_verification_error_code` text;
ALTER TABLE `challenge_funds` ADD COLUMN `verification_checked_at` text;
ALTER TABLE `challenge_funds` ADD COLUMN `verification_attempts` integer NOT NULL DEFAULT 0;
CREATE INDEX `idx_challenge_funds_submitted_tx` ON `challenge_funds` (`submitted_tx`);
