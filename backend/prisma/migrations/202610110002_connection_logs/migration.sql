CREATE TABLE `connection_logs` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NULL,
  `user_agent` VARCHAR(512) NULL,
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ended_at` DATETIME(3) NULL,

  UNIQUE INDEX `connection_logs_session_id_key` (`session_id`),
  INDEX `connection_logs_user_id_last_seen_at_idx` (`user_id`, `last_seen_at`),
  INDEX `connection_logs_last_seen_at_idx` (`last_seen_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `connection_logs_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `connection_logs` (`id`, `user_id`, `session_id`, `user_agent`, `started_at`, `last_seen_at`)
SELECT UUID(), `user_id`, `id`, `user_agent`, `created_at`, `last_seen_at`
FROM `sessions`;
