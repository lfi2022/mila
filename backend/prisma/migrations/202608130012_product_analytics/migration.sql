CREATE TABLE `product_analytics_events` (
  `id` CHAR(36) NOT NULL,
  `event` VARCHAR(64) NOT NULL,
  `subject_hash` CHAR(64) NOT NULL,
  `session_hash` CHAR(64) NOT NULL,
  `path` VARCHAR(255) NULL,
  `properties` JSON NULL,
  `occurred_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `product_analytics_events_session_hash_event_occurred_at_key` (`session_hash`, `event`, `occurred_at`),
  INDEX `product_analytics_events_event_occurred_at_idx` (`event`, `occurred_at`),
  INDEX `product_analytics_events_subject_hash_occurred_at_idx` (`subject_hash`, `occurred_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
