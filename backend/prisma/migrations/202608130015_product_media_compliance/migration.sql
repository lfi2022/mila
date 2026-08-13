-- Preserve legacy media records but deny display until their provenance is reviewed.
ALTER TABLE `gift_images`
  MODIFY `status` ENUM('PENDING','ACTIVE','EXPIRED','REMOVED','BLOCKED') NOT NULL DEFAULT 'ACTIVE',
  MODIFY `source_type` ENUM('OFFICIAL_API','AFFILIATE_FEED','REMOTE','USER_UPLOAD','PLACEHOLDER','LICENSED','USER_UPLOADED','REMOTE_VERIFIED','REMOTE_UNVERIFIED','GENERIC_LIBRARY','GENERATED','BLOCKED') NOT NULL,
  MODIFY `usage_policy` ENUM('OFFICIAL_API','AFFILIATE_FEED','REMOTE_DISPLAY_ALLOWED','TEMPORARY_CACHE_ALLOWED','USER_UPLOADED','MANUAL_REVIEW_REQUIRED','DO_NOT_DISPLAY','AUTHORIZED','AUTHORIZED_REMOTE_ONLY','AUTHORIZED_CACHE','USER_DECLARED','REVIEW_REQUIRED','BLOCKED') NOT NULL;

UPDATE `gift_images` SET `source_type` = CASE
  WHEN `source_type` = 'USER_UPLOAD' THEN 'USER_UPLOADED'
  WHEN `source_type` = 'PLACEHOLDER' THEN 'GENERIC_LIBRARY'
  WHEN `source_type` = 'REMOTE' THEN 'REMOTE_UNVERIFIED'
  ELSE `source_type` END;
UPDATE `gift_images` SET `usage_policy` = CASE
  WHEN `usage_policy` = 'OFFICIAL_API' THEN 'AUTHORIZED'
  WHEN `usage_policy` = 'AFFILIATE_FEED' THEN 'AUTHORIZED'
  WHEN `usage_policy` = 'USER_UPLOADED' THEN 'USER_DECLARED'
  ELSE 'REVIEW_REQUIRED' END;

ALTER TABLE `gift_images`
  MODIFY `source_type` ENUM('OFFICIAL_API','AFFILIATE_FEED','LICENSED','USER_UPLOADED','REMOTE_VERIFIED','REMOTE_UNVERIFIED','GENERIC_LIBRARY','GENERATED','BLOCKED') NOT NULL,
  MODIFY `usage_policy` ENUM('AUTHORIZED','AUTHORIZED_REMOTE_ONLY','AUTHORIZED_CACHE','USER_DECLARED','REVIEW_REQUIRED','BLOCKED') NOT NULL,
  ADD COLUMN `public_url` VARCHAR(2048) NULL,
  ADD COLUMN `copyright_owner` VARCHAR(255) NULL,
  ADD COLUMN `license_name` VARCHAR(120) NULL,
  ADD COLUMN `license_url` VARCHAR(2048) NULL,
  ADD COLUMN `terms_url` VARCHAR(2048) NULL,
  ADD COLUMN `commercial_use_allowed` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `cache_allowed` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `remote_display_allowed` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `transformation_allowed` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `redistribution_allowed` BOOLEAN NOT NULL DEFAULT FALSE,
  CHANGE COLUMN `last_checked_at` `verified_at` DATETIME(3) NULL,
  ADD COLUMN `verified_by` CHAR(36) NULL,
  ADD COLUMN `review_after` DATETIME(3) NULL,
  ADD COLUMN `etag` VARCHAR(255) NULL,
  ADD COLUMN `last_modified` VARCHAR(255) NULL,
  ADD COLUMN `fetched_at` DATETIME(3) NULL,
  CHANGE COLUMN `cached_until` `expires_at` DATETIME(3) NULL,
  DROP COLUMN `cached`,
  ADD INDEX `gift_images_usage_policy_status_idx` (`usage_policy`, `status`),
  ADD INDEX `gift_images_expires_at_idx` (`expires_at`);

ALTER TABLE `gifts`
  ADD COLUMN `generic_image_category` ENUM('STROLLER','PLUSH_RABBIT','BABY_BOUNCER','BABY_CRIB','CLOTHING','FEEDING','BATH','TOY','OTHER') NOT NULL DEFAULT 'OTHER';

CREATE TABLE `merchant_media_policies` (
  `id` CHAR(36) NOT NULL, `merchant_id` CHAR(36) NOT NULL,
  `allow_metadata` BOOLEAN NOT NULL DEFAULT TRUE, `allow_remote_display` BOOLEAN NOT NULL DEFAULT FALSE,
  `allow_caching` BOOLEAN NOT NULL DEFAULT FALSE, `allow_local_storage` BOOLEAN NOT NULL DEFAULT FALSE,
  `allow_transformation` BOOLEAN NOT NULL DEFAULT FALSE, `allow_commercial_use` BOOLEAN NOT NULL DEFAULT FALSE,
  `attribution_required` BOOLEAN NOT NULL DEFAULT FALSE, `attribution_template` VARCHAR(500) NULL,
  `license_source_url` VARCHAR(2048) NULL, `terms_source_url` VARCHAR(2048) NULL,
  `verified_at` DATETIME(3) NULL, `verified_by` CHAR(36) NULL, `review_after` DATETIME(3) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'REVIEW_REQUIRED', `notes` VARCHAR(2000) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `merchant_media_policies_merchant_id_key` (`merchant_id`),
  CONSTRAINT `merchant_media_policies_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `media_claims` (
  `id` CHAR(36) NOT NULL, `media_id` CHAR(36) NOT NULL, `claimant` VARCHAR(180) NOT NULL,
  `contact` VARCHAR(255) NOT NULL, `reason` VARCHAR(2000) NOT NULL,
  `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `status` VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  `action` VARCHAR(1000) NULL, `resolved_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`), INDEX `media_claims_status_received_at_idx` (`status`, `received_at`),
  CONSTRAINT `media_claims_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `gift_images` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
