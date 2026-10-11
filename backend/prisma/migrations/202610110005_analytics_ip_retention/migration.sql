ALTER TABLE `product_analytics_events`
  ADD COLUMN `ip_encrypted` VARCHAR(256) NULL,
  ADD COLUMN `ip_expires_at` DATETIME(3) NULL;

ALTER TABLE `analytics_visitors`
  ADD COLUMN `ip_encrypted` VARCHAR(256) NULL,
  ADD COLUMN `ip_expires_at` DATETIME(3) NULL;
