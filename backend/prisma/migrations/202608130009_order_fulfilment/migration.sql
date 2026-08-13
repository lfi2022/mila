ALTER TABLE `order_groups`
  ADD COLUMN `grouping_key` CHAR(64) NULL,
  ADD COLUMN `destination_key` CHAR(64) NULL,
  ADD COLUMN `order_window_start` DATETIME(3) NULL,
  ADD COLUMN `order_window_end` DATETIME(3) NULL,
  ADD COLUMN `delivery_minor` BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN `external_order_reference` VARCHAR(255) NULL,
  ADD COLUMN `tracking_url` VARCHAR(2048) NULL;

UPDATE `order_groups`
SET `grouping_key` = SHA2(CONCAT(`list_id`, ':', `merchant_id`, ':', `id`), 256),
    `destination_key` = SHA2(CONCAT('legacy:', `list_id`), 256);

ALTER TABLE `order_groups`
  MODIFY `grouping_key` CHAR(64) NOT NULL,
  MODIFY `destination_key` CHAR(64) NOT NULL,
  ADD INDEX `order_groups_list_id_grouping_key_idx` (`list_id`, `grouping_key`);

ALTER TABLE `order_group_items`
  ADD COLUMN `title_snapshot` VARCHAR(240) NULL,
  ADD COLUMN `url_snapshot` VARCHAR(2048) NULL,
  ADD COLUMN `delivery_amount_minor` BIGINT NOT NULL DEFAULT 0;

UPDATE `order_group_items` item
JOIN `gifts` gift ON gift.`id` = item.`gift_id`
SET item.`title_snapshot` = gift.`title`, item.`url_snapshot` = gift.`url`;

ALTER TABLE `order_group_items`
  MODIFY `title_snapshot` VARCHAR(240) NOT NULL;

CREATE TABLE `order_group_status_history` (
  `id` CHAR(36) NOT NULL,
  `order_group_id` CHAR(36) NOT NULL,
  `actor_id` CHAR(36) NOT NULL,
  `from_status` ENUM('DRAFT','READY','WAITING_PARENT','SUBMITTED','PARTIALLY_ORDERED','ORDERED','SHIPPED','COMPLETED','CANCELLED') NULL,
  `to_status` ENUM('DRAFT','READY','WAITING_PARENT','SUBMITTED','PARTIALLY_ORDERED','ORDERED','SHIPPED','COMPLETED','CANCELLED') NOT NULL,
  `reason` VARCHAR(500) NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `order_group_status_history_order_group_id_created_at_idx` (`order_group_id`, `created_at`),
  CONSTRAINT `order_group_status_history_order_group_id_fkey` FOREIGN KEY (`order_group_id`) REFERENCES `order_groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_group_status_history_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
