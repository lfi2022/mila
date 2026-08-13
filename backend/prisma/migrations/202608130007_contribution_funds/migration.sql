ALTER TABLE `contributions`
  MODIFY `gift_id` CHAR(36) NULL,
  ADD COLUMN `fee_minor` BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN `platform_share_minor` BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN `metadata` JSON NULL,
  ADD COLUMN `idempotency_key` VARCHAR(255) NULL;

UPDATE `contributions` SET `idempotency_key` = CONCAT('legacy:', `id`);
ALTER TABLE `contributions`
  MODIFY `idempotency_key` VARCHAR(255) NOT NULL,
  ADD UNIQUE KEY `contributions_idempotency_key_key` (`idempotency_key`);

ALTER TABLE `bank_transfers`
  ADD COLUMN `contribution_id` CHAR(36) NULL,
  ADD UNIQUE KEY `bank_transfers_contribution_id_key` (`contribution_id`),
  ADD CONSTRAINT `bank_transfers_contribution_id_fkey`
    FOREIGN KEY (`contribution_id`) REFERENCES `contributions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `funds_ledger_entries` (
  `id` CHAR(36) NOT NULL, `list_id` CHAR(36) NOT NULL, `contribution_id` CHAR(36) NULL,
  `type` VARCHAR(64) NOT NULL,
  `status` ENUM('PENDING','CONFIRMED','CANCELLED','EXPIRED','REVERSED') NOT NULL DEFAULT 'PENDING',
  `amount_minor` BIGINT NOT NULL, `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
  `idempotency_key` VARCHAR(255) NOT NULL, `source_type` VARCHAR(120) NULL,
  `source_id` VARCHAR(255) NULL, `metadata` JSON NULL, `settled_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  UNIQUE KEY `funds_ledger_entries_idempotency_key_key` (`idempotency_key`),
  KEY `funds_ledger_entries_list_id_status_created_at_idx` (`list_id`,`status`,`created_at`),
  KEY `funds_ledger_entries_source_type_source_id_idx` (`source_type`,`source_id`),
  CONSTRAINT `funds_ledger_entries_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `funds_ledger_entries_contribution_id_fkey` FOREIGN KEY (`contribution_id`) REFERENCES `contributions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `holding_balances` (
  `id` CHAR(36) NOT NULL, `list_id` CHAR(36) NOT NULL, `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
  `cached_minor` BIGINT NOT NULL DEFAULT 0, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL, PRIMARY KEY (`id`),
  UNIQUE KEY `holding_balances_list_id_currency_key` (`list_id`,`currency`),
  CONSTRAINT `holding_balances_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `transfer_instructions` (
  `id` CHAR(36) NOT NULL, `bank_transfer_id` CHAR(36) NOT NULL, `beneficiary` VARCHAR(180) NOT NULL,
  `iban_masked` VARCHAR(64) NOT NULL, `reference` VARCHAR(64) NOT NULL, `amount_minor` BIGINT NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'EUR', `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  UNIQUE KEY `transfer_instructions_bank_transfer_id_key` (`bank_transfer_id`),
  CONSTRAINT `transfer_instructions_bank_transfer_id_fkey` FOREIGN KEY (`bank_transfer_id`) REFERENCES `bank_transfers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payouts` (
  `id` CHAR(36) NOT NULL, `list_id` CHAR(36) NOT NULL, `requested_by_id` CHAR(36) NOT NULL,
  `amount_minor` BIGINT NOT NULL, `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
  `status` VARCHAR(32) NOT NULL DEFAULT 'DISABLED', `provider` VARCHAR(64) NULL,
  `external_id` VARCHAR(255) NULL, `metadata` JSON NULL, `processed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), KEY `payouts_list_id_status_idx` (`list_id`,`status`),
  KEY `payouts_provider_external_id_idx` (`provider`,`external_id`),
  CONSTRAINT `payouts_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `payouts_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
