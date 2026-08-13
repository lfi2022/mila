ALTER TABLE `privacy_consents` ADD COLUMN `evidence` JSON NULL;

CREATE TABLE `data_subject_requests` (
  `id` CHAR(36) NOT NULL,
  `requester_user_id` CHAR(36) NULL,
  `subject_email` VARCHAR(255) NOT NULL,
  `type` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  `details` VARCHAR(2000) NULL,
  `resolution` VARCHAR(2000) NULL,
  `assigned_to_id` CHAR(36) NULL,
  `due_at` DATETIME(3) NOT NULL,
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `data_subject_requests_status_due_at_idx` (`status`, `due_at`),
  INDEX `data_subject_requests_requester_user_id_created_at_idx` (`requester_user_id`, `created_at`),
  INDEX `data_subject_requests_subject_email_created_at_idx` (`subject_email`, `created_at`),
  CONSTRAINT `data_subject_requests_requester_user_id_fkey`
    FOREIGN KEY (`requester_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `data_subject_requests_assigned_to_id_fkey`
    FOREIGN KEY (`assigned_to_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
