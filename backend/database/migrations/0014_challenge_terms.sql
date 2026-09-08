ALTER TABLE `challenge_funds` ADD COLUMN `terms_version` text;
ALTER TABLE `challenge_funds` ADD COLUMN `terms_hash` text;
ALTER TABLE `challenge_funds` ADD COLUMN `terms_signature` text;
ALTER TABLE `challenge_funds` ADD COLUMN `terms_signer_wallet` text;
ALTER TABLE `challenge_funds` ADD COLUMN `terms_accepted_at` text;
ALTER TABLE `challenge_funds` ADD COLUMN `locked_at` text;
ALTER TABLE `challenge_funds` ADD COLUMN `refund_policy_state` text NOT NULL DEFAULT 'pre_publish';
