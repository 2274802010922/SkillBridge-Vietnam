ALTER TABLE `cashout_beneficiaries` ADD COLUMN `payout_method` text NOT NULL DEFAULT 'bank';
ALTER TABLE `cashout_beneficiaries` ADD COLUMN `payout_provider` text NOT NULL DEFAULT 'sandbox';
ALTER TABLE `cashout_beneficiaries` ADD COLUMN `verification_state` text NOT NULL DEFAULT 'sandbox_verified';

ALTER TABLE `cashout_sessions` ADD COLUMN `payout_method` text NOT NULL DEFAULT 'bank';
ALTER TABLE `cashout_sessions` ADD COLUMN `payout_provider` text NOT NULL DEFAULT 'sandbox';
ALTER TABLE `cashout_sessions` ADD COLUMN `execution_mode` text NOT NULL DEFAULT 'devnet_sandbox';
ALTER TABLE `cashout_sessions` ADD COLUMN `payout_status` text NOT NULL DEFAULT 'not_started';
