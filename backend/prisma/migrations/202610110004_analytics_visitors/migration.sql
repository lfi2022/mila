ALTER TABLE `product_analytics_events`
  ADD COLUMN `ip_hash` CHAR(64) NULL,
  ADD INDEX `product_analytics_events_ip_hash_occurred_at_idx` (`ip_hash`, `occurred_at`);

CREATE TABLE `analytics_visitors` (
  `id` CHAR(36) NOT NULL,
  `visitor_hash` CHAR(64) NOT NULL,
  `ip_hash` CHAR(64) NULL,
  `first_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `visit_count` INT NOT NULL DEFAULT 0,
  `page_views` INT NOT NULL DEFAULT 0,
  `event_count` INT NOT NULL DEFAULT 0,
  `first_path` VARCHAR(255) NULL,
  `last_path` VARCHAR(255) NULL,
  `device` VARCHAR(180) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `analytics_visitors_visitor_hash_key` (`visitor_hash`),
  INDEX `analytics_visitors_last_seen_at_idx` (`last_seen_at`),
  INDEX `analytics_visitors_ip_hash_last_seen_at_idx` (`ip_hash`, `last_seen_at`)
);
