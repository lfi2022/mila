CREATE TABLE `notification_preferences` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `type` VARCHAR(64) NOT NULL,
  `in_app_enabled` BOOLEAN NOT NULL DEFAULT true,
  `email_enabled` BOOLEAN NOT NULL DEFAULT true,
  `digest` VARCHAR(16) NOT NULL DEFAULT 'IMMEDIATE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `notification_preferences_user_id_type_key` (`user_id`, `type`),
  INDEX `notification_preferences_user_id_email_enabled_idx` (`user_id`, `email_enabled`),
  PRIMARY KEY (`id`),
  CONSTRAINT `notification_preferences_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
