ALTER TABLE `merchants`
  ADD COLUMN `offer_trust_score` TINYINT UNSIGNED NOT NULL DEFAULT 50,
  ADD COLUMN `refresh_min_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 1440;

ALTER TABLE `product_identities`
  ADD COLUMN `identity_key` VARCHAR(255) NULL,
  ADD COLUMN `match_status` VARCHAR(32) NOT NULL DEFAULT 'CONTROLLED',
  ADD UNIQUE KEY `product_identities_identity_key_key` (`identity_key`);

ALTER TABLE `gifts`
  ADD COLUMN `dead_link_alerts_enabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `last_availability` VARCHAR(64) NULL,
  ADD COLUMN `last_link_healthy` BOOLEAN NULL,
  ADD COLUMN `refresh_failure_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN `next_refresh_at` DATETIME(3) NULL,
  ADD INDEX `gifts_next_refresh_at_status_idx` (`next_refresh_at`, `status`);

ALTER TABLE `merchant_offers`
  ADD COLUMN `delivery_eta_days` SMALLINT UNSIGNED NULL,
  ADD COLUMN `match_confidence` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN `match_method` VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN `source` VARCHAR(32) NOT NULL DEFAULT 'MANUAL';

ALTER TABLE `price_snapshots`
  MODIFY `price_minor` BIGINT NULL,
  ADD COLUMN `link_healthy` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `error_code` VARCHAR(64) NULL;

CREATE TABLE `gift_offer_switches` (
  `id` CHAR(36) NOT NULL,
  `gift_id` CHAR(36) NOT NULL,
  `from_merchant_id` CHAR(36) NULL,
  `to_merchant_id` CHAR(36) NOT NULL,
  `offer_id` CHAR(36) NOT NULL,
  `from_url` VARCHAR(2048) NULL,
  `to_url` VARCHAR(2048) NOT NULL,
  `from_price_minor` BIGINT NOT NULL,
  `to_total_minor` BIGINT NOT NULL,
  `savings_minor` BIGINT NOT NULL,
  `match_confidence` TINYINT UNSIGNED NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `gift_offer_switches_gift_id_created_at_idx` (`gift_id`, `created_at`),
  CONSTRAINT `gift_offer_switches_gift_id_fkey` FOREIGN KEY (`gift_id`) REFERENCES `gifts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
