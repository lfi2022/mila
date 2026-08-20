CREATE TABLE `parent_bank_accounts` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `beneficiary` VARCHAR(180) NOT NULL,
  `iban_encrypted` VARCHAR(512) NOT NULL,
  `iban_fingerprint` CHAR(64) NOT NULL,
  `iban_masked` VARCHAR(64) NOT NULL,
  `key_version` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `parent_bank_accounts_user_id_key` (`user_id`),
  INDEX `parent_bank_accounts_iban_fingerprint_idx` (`iban_fingerprint`),
  PRIMARY KEY (`id`),
  CONSTRAINT `parent_bank_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `contributions` ADD COLUMN `confirmed_by_id` CHAR(36) NULL;
ALTER TABLE `contributions` ADD INDEX `contributions_confirmed_by_id_idx` (`confirmed_by_id`);
ALTER TABLE `contributions` ADD CONSTRAINT `contributions_confirmed_by_id_fkey` FOREIGN KEY (`confirmed_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `transfer_instructions` ADD COLUMN `iban_encrypted` VARCHAR(512) NULL;
