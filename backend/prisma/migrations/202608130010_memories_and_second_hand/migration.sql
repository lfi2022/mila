CREATE TABLE `second_hand_offers` (
  `id` CHAR(36) NOT NULL,
  `list_id` CHAR(36) NOT NULL,
  `gift_id` CHAR(36) NOT NULL,
  `proposer_name` VARCHAR(120) NOT NULL,
  `proposer_email` VARCHAR(255) NULL,
  `condition` ENUM('LIKE_NEW', 'VERY_GOOD', 'GOOD', 'FAIR') NOT NULL,
  `comment` VARCHAR(2000) NULL,
  `photo_storage_key` VARCHAR(512) NULL,
  `photo_mime_type` VARCHAR(120) NULL,
  `photo_size_bytes` BIGINT NULL,
  `photo_scan_status` VARCHAR(32) NULL,
  `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN') NOT NULL DEFAULT 'PENDING',
  `management_token_hash` CHAR(64) NOT NULL,
  `token_expires_at` DATETIME(3) NOT NULL,
  `reviewed_by_id` CHAR(36) NULL,
  `reviewed_at` DATETIME(3) NULL,
  `review_comment` VARCHAR(1000) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `second_hand_offers_management_token_hash_key` (`management_token_hash`),
  INDEX `second_hand_offers_list_id_status_created_at_idx` (`list_id`, `status`, `created_at`),
  INDEX `second_hand_offers_gift_id_status_idx` (`gift_id`, `status`),
  CONSTRAINT `second_hand_offers_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `second_hand_offers_gift_id_fkey` FOREIGN KEY (`gift_id`) REFERENCES `gifts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `second_hand_offers_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `messages`
  ADD COLUMN `approved_for_memory` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `approved_by_id` CHAR(36) NULL,
  ADD COLUMN `approved_at` DATETIME(3) NULL,
  ADD CONSTRAINT `messages_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `media_assets`
  ADD COLUMN `transcode_status` VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN `transcoded_storage_key` VARCHAR(512) NULL,
  ADD COLUMN `duration_seconds` SMALLINT UNSIGNED NULL,
  ADD COLUMN `retention_until` DATETIME(3) NULL;

ALTER TABLE `thank_yous`
  ADD COLUMN `draft_approved_at` DATETIME(3) NULL,
  ADD COLUMN `card_theme` VARCHAR(64) NULL,
  ADD COLUMN `card_message` TEXT NULL,
  ADD COLUMN `card_created_at` DATETIME(3) NULL;

CREATE TABLE `memory_books` (
  `id` CHAR(36) NOT NULL,
  `list_id` CHAR(36) NOT NULL,
  `theme` VARCHAR(64) NOT NULL DEFAULT 'soft',
  `title` VARCHAR(180) NULL,
  `introduction` TEXT NULL,
  `retention_months` SMALLINT UNSIGNED NOT NULL DEFAULT 24,
  `export_prepared_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `memory_books_list_id_key` (`list_id`),
  CONSTRAINT `memory_books_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `memory_book_items` (
  `id` CHAR(36) NOT NULL,
  `memory_book_id` CHAR(36) NOT NULL,
  `source_type` VARCHAR(32) NOT NULL,
  `source_id` CHAR(36) NOT NULL,
  `caption` VARCHAR(1000) NULL,
  `position` INTEGER NOT NULL DEFAULT 0,
  `approved_by_id` CHAR(36) NOT NULL,
  `approved_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `memory_book_items_memory_book_id_source_type_source_id_key` (`memory_book_id`, `source_type`, `source_id`),
  INDEX `memory_book_items_memory_book_id_position_idx` (`memory_book_id`, `position`),
  CONSTRAINT `memory_book_items_memory_book_id_fkey` FOREIGN KEY (`memory_book_id`) REFERENCES `memory_books` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `memory_book_items_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
