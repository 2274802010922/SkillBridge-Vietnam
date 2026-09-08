ALTER TABLE `cashout_beneficiaries` ADD COLUMN `bank_bin` text;
ALTER TABLE `cashout_beneficiaries` ADD COLUMN `bank_name` text;
ALTER TABLE `cashout_beneficiaries` ADD COLUMN `verification_provider` text NOT NULL DEFAULT 'sandbox_directory';
ALTER TABLE `cashout_beneficiaries` ADD COLUMN `verification_reference` text;
ALTER TABLE `cashout_beneficiaries` ADD COLUMN `verified_at` text;

ALTER TABLE `cashout_sessions` ADD COLUMN `quote_id` text;
ALTER TABLE `cashout_sessions` ADD COLUMN `reference_rate_vnd` text;
ALTER TABLE `cashout_sessions` ADD COLUMN `usdc_usd_rate` text;
ALTER TABLE `cashout_sessions` ADD COLUMN `usd_vnd_rate` text;
ALTER TABLE `cashout_sessions` ADD COLUMN `reference_updated_at` text;
ALTER TABLE `cashout_sessions` ADD COLUMN `reference_freshness` text;
ALTER TABLE `cashout_sessions` ADD COLUMN `spread_bps` text;
ALTER TABLE `cashout_sessions` ADD COLUMN `quote_payload_hash` text;

CREATE TABLE IF NOT EXISTS `fx_rate_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `cashout_session_id` text REFERENCES `cashout_sessions`(`id`) ON DELETE cascade,
  `provider` text NOT NULL,
  `pair` text NOT NULL,
  `rate` text NOT NULL,
  `source_updated_at` text NOT NULL,
  `freshness` text NOT NULL,
  `confidence` text,
  `payload_hash` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS `idx_fx_rate_snapshots_cashout_created` ON `fx_rate_snapshots` (`cashout_session_id`, `created_at`);
