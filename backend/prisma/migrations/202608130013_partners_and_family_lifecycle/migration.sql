ALTER TABLE `partners`
  ADD COLUMN `slug` VARCHAR(120) NULL,
  ADD COLUMN `summary` VARCHAR(500) NULL,
  ADD COLUMN `website_url` VARCHAR(2048) NULL,
  ADD COLUMN `landing_title` VARCHAR(180) NULL,
  ADD COLUMN `landing_body` TEXT NULL;

UPDATE `partners` SET `slug` = CONCAT('partner-', LEFT(`id`, 8)) WHERE `slug` IS NULL;
ALTER TABLE `partners` MODIFY `slug` VARCHAR(120) NOT NULL;
CREATE UNIQUE INDEX `partners_slug_key` ON `partners` (`slug`);

ALTER TABLE `partner_campaigns` ADD COLUMN `code` VARCHAR(64) NULL;
UPDATE `partner_campaigns` SET `code` = CONCAT('campaign-', LEFT(`id`, 8)) WHERE `code` IS NULL;
ALTER TABLE `partner_campaigns` MODIFY `code` VARCHAR(64) NOT NULL;
CREATE UNIQUE INDEX `partner_campaigns_code_key` ON `partner_campaigns` (`code`);

ALTER TABLE `lists`
  ADD COLUMN `source_list_id` CHAR(36) NULL,
  ADD COLUMN `closed_at` DATETIME(3) NULL;
CREATE INDEX `lists_source_list_id_created_at_idx` ON `lists` (`source_list_id`, `created_at`);
ALTER TABLE `lists` ADD CONSTRAINT `lists_source_list_id_fkey`
  FOREIGN KEY (`source_list_id`) REFERENCES `lists` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `partner_attributions` (
  `id` CHAR(36) NOT NULL,
  `partner_id` CHAR(36) NOT NULL,
  `campaign_id` CHAR(36) NULL,
  `user_id` CHAR(36) NULL,
  `list_id` CHAR(36) NULL,
  `token_hash` CHAR(64) NOT NULL,
  `channel` VARCHAR(32) NOT NULL DEFAULT 'LINK',
  `expires_at` DATETIME(3) NOT NULL,
  `converted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `partner_attributions_list_id_key` (`list_id`),
  UNIQUE INDEX `partner_attributions_token_hash_key` (`token_hash`),
  INDEX `partner_attributions_partner_id_created_at_idx` (`partner_id`, `created_at`),
  INDEX `partner_attributions_campaign_id_converted_at_idx` (`campaign_id`, `converted_at`),
  INDEX `partner_attributions_expires_at_idx` (`expires_at`),
  CONSTRAINT `partner_attributions_partner_id_fkey` FOREIGN KEY (`partner_id`) REFERENCES `partners` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `partner_attributions_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `partner_campaigns` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `partner_attributions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `partner_attributions_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `partner_campaign_ledger_entries` (
  `id` CHAR(36) NOT NULL,
  `campaign_id` CHAR(36) NOT NULL,
  `attribution_id` CHAR(36) NULL,
  `kind` VARCHAR(32) NOT NULL,
  `amount_minor` BIGINT NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
  `idempotency_key` VARCHAR(255) NOT NULL,
  `note` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `partner_campaign_ledger_entries_idempotency_key_key` (`idempotency_key`),
  INDEX `partner_campaign_ledger_entries_campaign_id_kind_created_at_idx` (`campaign_id`, `kind`, `created_at`),
  CONSTRAINT `partner_campaign_ledger_entries_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `partner_campaigns` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `partner_campaign_ledger_entries_attribution_id_fkey` FOREIGN KEY (`attribution_id`) REFERENCES `partner_attributions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `list_lifecycle_events` (
  `id` CHAR(36) NOT NULL,
  `list_id` CHAR(36) NOT NULL,
  `actor_id` CHAR(36) NOT NULL,
  `action` VARCHAR(32) NOT NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `list_lifecycle_events_list_id_created_at_idx` (`list_id`, `created_at`),
  CONSTRAINT `list_lifecycle_events_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `list_lifecycle_events_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
