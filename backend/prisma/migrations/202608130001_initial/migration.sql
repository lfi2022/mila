-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(120) NULL,
    `avatar_key` VARCHAR(512) NULL,
    `email_verified_at` DATETIME(3) NULL,
    `onboarding_completed` BOOLEAN NOT NULL DEFAULT false,
    `suspended_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `role` ENUM('USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_roles_role_idx`(`role`),
    UNIQUE INDEX `user_roles_user_id_role_key`(`user_id`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `ip_hash` CHAR(64) NULL,
    `user_agent` VARCHAR(512) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sessions_token_hash_key`(`token_hash`),
    INDEX `sessions_user_id_expires_at_idx`(`user_id`, `expires_at`),
    INDEX `sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_verification_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_verification_tokens_token_hash_key`(`token_hash`),
    INDEX `email_verification_tokens_user_id_expires_at_idx`(`user_id`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_hash_key`(`token_hash`),
    INDEX `password_reset_tokens_user_id_expires_at_idx`(`user_id`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lists` (
    `id` CHAR(36) NOT NULL,
    `owner_id` CHAR(36) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `title` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,
    `welcome_message` TEXT NULL,
    `child_name` VARCHAR(120) NULL,
    `cover_media_key` VARCHAR(512) NULL,
    `due_date` DATE NULL,
    `type` ENUM('BIRTH', 'BIRTHDAY', 'CHRISTENING', 'CHRISTMAS', 'WEDDING', 'OTHER') NOT NULL DEFAULT 'BIRTH',
    `visibility` ENUM('PUBLIC', 'UNLISTED', 'PROTECTED') NOT NULL DEFAULT 'UNLISTED',
    `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED', 'SUSPENDED', 'DELETED') NOT NULL DEFAULT 'DRAFT',
    `access_code_hash` VARCHAR(255) NULL,
    `surprise_mode` BOOLEAN NOT NULL DEFAULT false,
    `hide_reserved_gifts` BOOLEAN NOT NULL DEFAULT false,
    `allow_indexing` BOOLEAN NOT NULL DEFAULT false,
    `show_progress` BOOLEAN NOT NULL DEFAULT true,
    `theme` VARCHAR(64) NOT NULL DEFAULT 'default',
    `accent_color` VARCHAR(16) NULL,
    `product_auto_refresh` BOOLEAN NOT NULL DEFAULT true,
    `auto_update_price` BOOLEAN NOT NULL DEFAULT true,
    `auto_update_image` BOOLEAN NOT NULL DEFAULT true,
    `auto_replace_dead_link` BOOLEAN NOT NULL DEFAULT false,
    `auto_suggest_better_offer` BOOLEAN NOT NULL DEFAULT true,
    `auto_switch_better_offer` BOOLEAN NOT NULL DEFAULT false,
    `automatic_ordering_allowed` BOOLEAN NOT NULL DEFAULT false,
    `archived_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lists_slug_key`(`slug`),
    INDEX `lists_owner_id_status_idx`(`owner_id`, `status`),
    INDEX `lists_visibility_status_idx`(`visibility`, `status`),
    INDEX `lists_due_date_idx`(`due_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `list_members` (
    `id` CHAR(36) NOT NULL,
    `list_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `role` ENUM('OWNER', 'CO_OWNER', 'EDITOR') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `list_members_user_id_role_idx`(`user_id`, `role`),
    UNIQUE INDEX `list_members_list_id_user_id_key`(`list_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `list_invitations` (
    `id` CHAR(36) NOT NULL,
    `list_id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `role` ENUM('OWNER', 'CO_OWNER', 'EDITOR') NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `invited_by_id` CHAR(36) NOT NULL,
    `accepted_by_id` CHAR(36) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `accepted_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `list_invitations_token_hash_key`(`token_hash`),
    INDEX `list_invitations_list_id_email_idx`(`list_id`, `email`),
    INDEX `list_invitations_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `merchants` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `logo_key` VARCHAR(512) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `affiliation_enabled` BOOLEAN NOT NULL DEFAULT false,
    `affiliate_network` VARCHAR(120) NULL,
    `affiliate_identifier` VARCHAR(255) NULL,
    `reward_enabled` BOOLEAN NOT NULL DEFAULT false,
    `reward_share_rate_bps` SMALLINT UNSIGNED NULL,
    `connector_type` VARCHAR(64) NOT NULL DEFAULT 'MANUAL',
    `automation_trust_level` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `connector_config` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `merchants_slug_key`(`slug`),
    INDEX `merchants_active_affiliation_enabled_idx`(`active`, `affiliation_enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `merchant_domains` (
    `id` CHAR(36) NOT NULL,
    `merchant_id` CHAR(36) NOT NULL,
    `domain` VARCHAR(253) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `merchant_domains_domain_key`(`domain`),
    INDEX `merchant_domains_merchant_id_idx`(`merchant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_identities` (
    `id` CHAR(36) NOT NULL,
    `gtin` VARCHAR(32) NULL,
    `ean` VARCHAR(32) NULL,
    `mpn` VARCHAR(120) NULL,
    `brand` VARCHAR(120) NULL,
    `model` VARCHAR(180) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `product_identities_gtin_idx`(`gtin`),
    INDEX `product_identities_ean_idx`(`ean`),
    INDEX `product_identities_mpn_idx`(`mpn`),
    INDEX `product_identities_brand_model_idx`(`brand`, `model`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gifts` (
    `id` CHAR(36) NOT NULL,
    `list_id` CHAR(36) NOT NULL,
    `merchant_id` CHAR(36) NULL,
    `product_identity_id` CHAR(36) NULL,
    `public_token` CHAR(64) NOT NULL,
    `title` VARCHAR(240) NOT NULL,
    `description` TEXT NULL,
    `kind` ENUM('LINK', 'PRODUCT', 'SERVICE', 'EXPERIENCE', 'FREE_GIFT', 'CONTRIBUTION') NOT NULL,
    `status` ENUM('AVAILABLE', 'RESERVED', 'FUNDED', 'READY_TO_ORDER', 'ORDERED', 'SHIPPED', 'RECEIVED', 'CANCELLED', 'UNAVAILABLE') NOT NULL DEFAULT 'AVAILABLE',
    `url` VARCHAR(2048) NULL,
    `canonical_url` VARCHAR(2048) NULL,
    `sku` VARCHAR(120) NULL,
    `selected_variant` JSON NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
    `unit_price_minor` BIGINT NULL,
    `price_at_creation_minor` BIGINT NULL,
    `quantity` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `reserved_quantity` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `funded_amount_minor` BIGINT NOT NULL DEFAULT 0,
    `contribution_target_minor` BIGINT NULL,
    `second_hand_policy` ENUM('NEW_ONLY', 'SECOND_HAND_ALLOWED', 'SECOND_HAND_PREFERRED') NOT NULL DEFAULT 'NEW_ONLY',
    `offer_preference` ENUM('FIXED_MERCHANT', 'SUGGEST_BEST', 'AUTO_BEST') NOT NULL DEFAULT 'FIXED_MERCHANT',
    `position` INTEGER NOT NULL DEFAULT 0,
    `hidden_by_moderator` BOOLEAN NOT NULL DEFAULT false,
    `price_alerts_enabled` BOOLEAN NOT NULL DEFAULT false,
    `availability_alerts_enabled` BOOLEAN NOT NULL DEFAULT false,
    `last_refreshed_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `gifts_public_token_key`(`public_token`),
    INDEX `gifts_list_id_position_idx`(`list_id`, `position`),
    INDEX `gifts_list_id_status_idx`(`list_id`, `status`),
    INDEX `gifts_merchant_id_status_idx`(`merchant_id`, `status`),
    INDEX `gifts_product_identity_id_idx`(`product_identity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_images` (
    `id` CHAR(36) NOT NULL,
    `gift_id` CHAR(36) NOT NULL,
    `merchant_id` CHAR(36) NULL,
    `source_url` VARCHAR(2048) NULL,
    `storage_key` VARCHAR(512) NULL,
    `source_type` ENUM('OFFICIAL_API', 'AFFILIATE_FEED', 'REMOTE', 'USER_UPLOAD', 'PLACEHOLDER') NOT NULL,
    `usage_policy` ENUM('OFFICIAL_API', 'AFFILIATE_FEED', 'REMOTE_DISPLAY_ALLOWED', 'TEMPORARY_CACHE_ALLOWED', 'USER_UPLOADED', 'MANUAL_REVIEW_REQUIRED', 'DO_NOT_DISPLAY') NOT NULL,
    `cached` BOOLEAN NOT NULL DEFAULT false,
    `cached_until` DATETIME(3) NULL,
    `attribution_required` BOOLEAN NOT NULL DEFAULT false,
    `attribution_text` VARCHAR(500) NULL,
    `last_checked_at` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'REMOVED', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `gift_images_gift_id_position_idx`(`gift_id`, `position`),
    INDEX `gift_images_cached_until_idx`(`cached_until`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `merchant_offers` (
    `id` CHAR(36) NOT NULL,
    `gift_id` CHAR(36) NULL,
    `product_identity_id` CHAR(36) NOT NULL,
    `merchant_id` CHAR(36) NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `sku` VARCHAR(120) NULL,
    `price_minor` BIGINT NOT NULL,
    `delivery_minor` BIGINT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
    `available` BOOLEAN NULL,
    `affiliate_eligible` BOOLEAN NOT NULL DEFAULT false,
    `checked_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `merchant_offers_gift_id_idx`(`gift_id`),
    INDEX `merchant_offers_merchant_id_price_minor_idx`(`merchant_id`, `price_minor`),
    INDEX `merchant_offers_checked_at_idx`(`checked_at`),
    UNIQUE INDEX `merchant_offers_product_identity_id_merchant_id_url_key`(`product_identity_id`, `merchant_id`, `url`(191)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_snapshots` (
    `id` CHAR(36) NOT NULL,
    `gift_id` CHAR(36) NOT NULL,
    `merchant_id` CHAR(36) NULL,
    `price_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
    `availability` VARCHAR(64) NULL,
    `source` VARCHAR(64) NOT NULL,
    `checked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `price_snapshots_gift_id_checked_at_idx`(`gift_id`, `checked_at`),
    INDEX `price_snapshots_merchant_id_checked_at_idx`(`merchant_id`, `checked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservations` (
    `id` CHAR(36) NOT NULL,
    `list_id` CHAR(36) NOT NULL,
    `gift_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `guest_name` VARCHAR(80) NOT NULL,
    `guest_email` VARCHAR(255) NULL,
    `message` VARCHAR(800) NULL,
    `quantity` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `status` ENUM('RESERVED', 'PURCHASED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'RESERVED',
    `management_token_hash` CHAR(64) NOT NULL,
    `token_expires_at` DATETIME(3) NOT NULL,
    `purchased_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reservations_management_token_hash_key`(`management_token_hash`),
    INDEX `reservations_list_id_status_idx`(`list_id`, `status`),
    INDEX `reservations_gift_id_status_idx`(`gift_id`, `status`),
    INDEX `reservations_guest_email_idx`(`guest_email`),
    INDEX `reservations_token_expires_at_idx`(`token_expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contributions` (
    `id` CHAR(36) NOT NULL,
    `list_id` CHAR(36) NOT NULL,
    `gift_id` CHAR(36) NOT NULL,
    `reservation_id` CHAR(36) NULL,
    `payment_id` CHAR(36) NULL,
    `contributor_name` VARCHAR(120) NULL,
    `contributor_email` VARCHAR(255) NULL,
    `anonymous` BOOLEAN NOT NULL DEFAULT false,
    `message` VARCHAR(800) NULL,
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
    `status` ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'CHARGEDBACK') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmed_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contributions_payment_id_key`(`payment_id`),
    INDEX `contributions_list_id_status_idx`(`list_id`, `status`),
    INDEX `contributions_gift_id_status_idx`(`gift_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `affiliate_clicks` (
    `id` CHAR(36) NOT NULL,
    `token` CHAR(64) NOT NULL,
    `list_id` CHAR(36) NOT NULL,
    `gift_id` CHAR(36) NOT NULL,
    `merchant_id` CHAR(36) NULL,
    `campaign_reference` VARCHAR(120) NULL,
    `source` VARCHAR(120) NULL,
    `anonymous_reference` CHAR(64) NULL,
    `destination_url` VARCHAR(2048) NOT NULL,
    `affiliate_applied` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `affiliate_clicks_token_key`(`token`),
    INDEX `affiliate_clicks_list_id_created_at_idx`(`list_id`, `created_at`),
    INDEX `affiliate_clicks_merchant_id_created_at_idx`(`merchant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `affiliate_commissions` (
    `id` CHAR(36) NOT NULL,
    `network` VARCHAR(120) NOT NULL,
    `external_id` VARCHAR(255) NOT NULL,
    `click_id` CHAR(36) NULL,
    `merchant_id` CHAR(36) NULL,
    `order_reference` VARCHAR(255) NULL,
    `order_amount_minor` BIGINT NULL,
    `commission_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
    `status` ENUM('PENDING', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `occurred_at` DATETIME(3) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `affiliate_commissions_status_created_at_idx`(`status`, `created_at`),
    INDEX `affiliate_commissions_merchant_id_status_idx`(`merchant_id`, `status`),
    UNIQUE INDEX `affiliate_commissions_network_external_id_key`(`network`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reward_wallets` (
    `id` CHAR(36) NOT NULL,
    `list_id` CHAR(36) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
    `cached_available_minor` BIGINT NOT NULL DEFAULT 0,
    `cached_pending_minor` BIGINT NOT NULL DEFAULT 0,
    `flagged` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reward_wallets_list_id_key`(`list_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reward_transactions` (
    `id` CHAR(36) NOT NULL,
    `wallet_id` CHAR(36) NOT NULL,
    `commission_id` CHAR(36) NULL,
    `type` ENUM('AFFILIATE_COMMISSION', 'REFERRAL', 'PREMIUM_PURCHASE', 'PARTNER_BONUS', 'PROMOTIONAL_BONUS', 'REDEMPTION', 'ADJUSTMENT') NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'REVERSED') NOT NULL DEFAULT 'PENDING',
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
    `idempotency_key` VARCHAR(255) NOT NULL,
    `source_type` VARCHAR(120) NULL,
    `source_id` VARCHAR(255) NULL,
    `metadata` JSON NULL,
    `settled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `reward_transactions_idempotency_key_key`(`idempotency_key`),
    INDEX `reward_transactions_wallet_id_status_created_at_idx`(`wallet_id`, `status`, `created_at`),
    INDEX `reward_transactions_source_type_source_id_idx`(`source_type`, `source_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reward_redemptions` (
    `id` CHAR(36) NOT NULL,
    `wallet_id` CHAR(36) NOT NULL,
    `requested_by_id` CHAR(36) NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `status` ENUM('REQUESTED', 'APPROVED', 'PROCESSED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
    `metadata` JSON NULL,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reward_redemptions_wallet_id_status_idx`(`wallet_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `referrals` (
    `id` CHAR(36) NOT NULL,
    `referrer_user_id` CHAR(36) NOT NULL,
    `referred_user_id` CHAR(36) NOT NULL,
    `wallet_id` CHAR(36) NULL,
    `code` VARCHAR(32) NOT NULL,
    `status` ENUM('PENDING', 'QUALIFIED', 'REWARDED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `qualified_at` DATETIME(3) NULL,
    `rewarded_at` DATETIME(3) NULL,
    `risk_metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `referrals_referred_user_id_key`(`referred_user_id`),
    INDEX `referrals_status_created_at_idx`(`status`, `created_at`),
    UNIQUE INDEX `referrals_referrer_user_id_code_key`(`referrer_user_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `partners` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `category` VARCHAR(120) NOT NULL,
    `contact` JSON NULL,
    `region` VARCHAR(120) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    `contract_reference` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `partner_campaigns` (
    `id` CHAR(36) NOT NULL,
    `partner_id` CHAR(36) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `benefit` JSON NOT NULL,
    `budget_minor` BIGINT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
    `conditions` JSON NULL,
    `attribution_config` JSON NULL,
    `active` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `partner_campaigns_active_starts_at_ends_at_idx`(`active`, `starts_at`, `ends_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_accounts` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `provider` ENUM('MOLLIE', 'BANK_TRANSFER', 'MANUAL') NOT NULL,
    `external_account_id` VARCHAR(255) NULL,
    `onboarding_status` VARCHAR(64) NOT NULL DEFAULT 'NOT_STARTED',
    `encrypted_metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payment_accounts_user_id_provider_idx`(`user_id`, `provider`),
    UNIQUE INDEX `payment_accounts_provider_external_account_id_key`(`provider`, `external_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` CHAR(36) NOT NULL,
    `list_id` CHAR(36) NULL,
    `provider` ENUM('MOLLIE', 'BANK_TRANSFER', 'MANUAL') NOT NULL,
    `external_id` VARCHAR(255) NULL,
    `idempotency_key` VARCHAR(255) NOT NULL,
    `purpose` VARCHAR(64) NOT NULL,
    `status` ENUM('CREATED', 'OPEN', 'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGEDBACK') NOT NULL DEFAULT 'CREATED',
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
    `description` VARCHAR(255) NULL,
    `redirect_url` VARCHAR(2048) NULL,
    `webhook_last_seen_at` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_idempotency_key_key`(`idempotency_key`),
    INDEX `payments_list_id_status_idx`(`list_id`, `status`),
    INDEX `payments_status_created_at_idx`(`status`, `created_at`),
    UNIQUE INDEX `payments_provider_external_id_key`(`provider`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_routes` (
    `id` CHAR(36) NOT NULL,
    `payment_id` CHAR(36) NOT NULL,
    `payment_account_id` CHAR(36) NULL,
    `amount_minor` BIGINT NOT NULL,
    `route_type` VARCHAR(64) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    `external_route_id` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_routes_payment_id_idx`(`payment_id`),
    INDEX `payment_routes_payment_account_id_status_idx`(`payment_account_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refunds` (
    `id` CHAR(36) NOT NULL,
    `payment_id` CHAR(36) NOT NULL,
    `external_id` VARCHAR(255) NULL,
    `idempotency_key` VARCHAR(255) NOT NULL,
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `reason` VARCHAR(500) NULL,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `refunds_idempotency_key_key`(`idempotency_key`),
    INDEX `refunds_status_created_at_idx`(`status`, `created_at`),
    UNIQUE INDEX `refunds_payment_id_external_id_key`(`payment_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chargebacks` (
    `id` CHAR(36) NOT NULL,
    `payment_id` CHAR(36) NOT NULL,
    `external_id` VARCHAR(255) NOT NULL,
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
    `reason` VARCHAR(500) NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chargebacks_occurred_at_idx`(`occurred_at`),
    UNIQUE INDEX `chargebacks_payment_id_external_id_key`(`payment_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_transfers` (
    `id` CHAR(36) NOT NULL,
    `list_id` CHAR(36) NOT NULL,
    `reference` VARCHAR(64) NOT NULL,
    `expected_amount_minor` BIGINT NOT NULL,
    `received_amount_minor` BIGINT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
    `status` ENUM('WAITING_TRANSFER', 'TRANSFER_RECEIVED', 'MATCHED', 'MANUAL_REVIEW', 'REFUNDED') NOT NULL DEFAULT 'WAITING_TRANSFER',
    `payer_name` VARCHAR(180) NULL,
    `received_at` DATETIME(3) NULL,
    `matched_at` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bank_transfers_reference_key`(`reference`),
    INDEX `bank_transfers_list_id_status_idx`(`list_id`, `status`),
    INDEX `bank_transfers_status_received_at_idx`(`status`, `received_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_ledger_entries` (
    `id` CHAR(36) NOT NULL,
    `list_id` CHAR(36) NULL,
    `payment_id` CHAR(36) NULL,
    `type` ENUM('CONTRIBUTION_IN', 'CONTRIBUTION_REFUND', 'PARENT_PAYOUT', 'ORDER_PAYMENT', 'MOLLIE_FEE', 'PLATFORM_FEE', 'AFFILIATE_REVENUE', 'REWARD_CREDIT', 'REWARD_REDEMPTION', 'PREMIUM_REVENUE', 'ADJUSTMENT') NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'REVERSED') NOT NULL DEFAULT 'PENDING',
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
    `external_reference` VARCHAR(255) NULL,
    `idempotency_key` VARCHAR(255) NOT NULL,
    `source_type` VARCHAR(120) NULL,
    `source_id` VARCHAR(255) NULL,
    `metadata` JSON NULL,
    `settled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `financial_ledger_entries_idempotency_key_key`(`idempotency_key`),
    INDEX `financial_ledger_entries_list_id_status_created_at_idx`(`list_id`, `status`, `created_at`),
    INDEX `financial_ledger_entries_source_type_source_id_idx`(`source_type`, `source_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_groups` (
    `id` CHAR(36) NOT NULL,
    `list_id` CHAR(36) NOT NULL,
    `merchant_id` CHAR(36) NOT NULL,
    `status` ENUM('DRAFT', 'READY', 'WAITING_PARENT', 'SUBMITTED', 'PARTIALLY_ORDERED', 'ORDERED', 'SHIPPED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `order_mode` ENUM('MANUAL_PARENT', 'ASSISTED_PARENT', 'AUTOMATIC_PLATFORM') NOT NULL DEFAULT 'MANUAL_PARENT',
    `delivery_mode` VARCHAR(64) NULL,
    `destination` JSON NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
    `submitted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `order_groups_list_id_status_idx`(`list_id`, `status`),
    INDEX `order_groups_merchant_id_status_idx`(`merchant_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_group_items` (
    `id` CHAR(36) NOT NULL,
    `order_group_id` CHAR(36) NOT NULL,
    `gift_id` CHAR(36) NOT NULL,
    `quantity` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `unit_price_minor` BIGINT NOT NULL,
    `contribution_amount_minor` BIGINT NOT NULL DEFAULT 0,
    `selected_variant` JSON NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'READY',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `order_group_items_gift_id_idx`(`gift_id`),
    UNIQUE INDEX `order_group_items_order_group_id_gift_id_key`(`order_group_id`, `gift_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `list_id` CHAR(36) NULL,
    `type` VARCHAR(64) NOT NULL,
    `title` VARCHAR(180) NOT NULL,
    `body` VARCHAR(1000) NOT NULL,
    `data` JSON NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_read_at_created_at_idx`(`user_id`, `read_at`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` CHAR(36) NOT NULL,
    `list_id` CHAR(36) NOT NULL,
    `gift_id` CHAR(36) NULL,
    `reservation_id` CHAR(36) NULL,
    `author_user_id` CHAR(36) NULL,
    `guest_name` VARCHAR(120) NULL,
    `text` TEXT NULL,
    `hidden_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `messages_list_id_created_at_idx`(`list_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media_assets` (
    `id` CHAR(36) NOT NULL,
    `message_id` CHAR(36) NULL,
    `uploaded_by_id` CHAR(36) NULL,
    `kind` ENUM('IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT') NOT NULL,
    `storage_key` VARCHAR(512) NOT NULL,
    `mime_type` VARCHAR(120) NOT NULL,
    `size_bytes` BIGINT NOT NULL,
    `checksum` CHAR(64) NOT NULL,
    `scan_status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    `metadata` JSON NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `media_assets_storage_key_key`(`storage_key`),
    INDEX `media_assets_message_id_idx`(`message_id`),
    INDEX `media_assets_scan_status_created_at_idx`(`scan_status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thank_yous` (
    `id` CHAR(36) NOT NULL,
    `list_id` CHAR(36) NOT NULL,
    `gift_id` CHAR(36) NULL,
    `reservation_id` CHAR(36) NULL,
    `user_id` CHAR(36) NOT NULL,
    `received_at` DATETIME(3) NULL,
    `thanked_at` DATETIME(3) NULL,
    `draft` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `thank_yous_reservation_id_key`(`reservation_id`),
    INDEX `thank_yous_list_id_thanked_at_idx`(`list_id`, `thanked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reports` (
    `id` CHAR(36) NOT NULL,
    `reporter_id` CHAR(36) NULL,
    `list_id` CHAR(36) NULL,
    `target_type` VARCHAR(64) NOT NULL,
    `target_id` CHAR(36) NOT NULL,
    `reason` VARCHAR(120) NOT NULL,
    `details` VARCHAR(1000) NULL,
    `status` ENUM('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
    `resolution` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reports_status_created_at_idx`(`status`, `created_at`),
    INDEX `reports_target_type_target_id_idx`(`target_type`, `target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_audit_logs` (
    `id` CHAR(36) NOT NULL,
    `actor_id` CHAR(36) NULL,
    `action` VARCHAR(120) NOT NULL,
    `target_type` VARCHAR(64) NOT NULL,
    `target_id` CHAR(36) NULL,
    `reason` VARCHAR(500) NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `metadata` JSON NULL,
    `request_id` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_audit_logs_actor_id_created_at_idx`(`actor_id`, `created_at`),
    INDEX `admin_audit_logs_target_type_target_id_created_at_idx`(`target_type`, `target_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feature_flags` (
    `key` VARCHAR(120) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `description` VARCHAR(500) NULL,
    `config` JSON NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `list_entitlements` (
    `id` CHAR(36) NOT NULL,
    `list_id` CHAR(36) NOT NULL,
    `plan` VARCHAR(64) NOT NULL DEFAULT 'FREE',
    `starts_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `list_entitlements_list_id_key`(`list_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_verification_tokens` ADD CONSTRAINT `email_verification_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lists` ADD CONSTRAINT `lists_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `list_members` ADD CONSTRAINT `list_members_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `list_members` ADD CONSTRAINT `list_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `list_invitations` ADD CONSTRAINT `list_invitations_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `list_invitations` ADD CONSTRAINT `list_invitations_invited_by_id_fkey` FOREIGN KEY (`invited_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `list_invitations` ADD CONSTRAINT `list_invitations_accepted_by_id_fkey` FOREIGN KEY (`accepted_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `merchant_domains` ADD CONSTRAINT `merchant_domains_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gifts` ADD CONSTRAINT `gifts_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gifts` ADD CONSTRAINT `gifts_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gifts` ADD CONSTRAINT `gifts_product_identity_id_fkey` FOREIGN KEY (`product_identity_id`) REFERENCES `product_identities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_images` ADD CONSTRAINT `gift_images_gift_id_fkey` FOREIGN KEY (`gift_id`) REFERENCES `gifts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_images` ADD CONSTRAINT `gift_images_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `merchant_offers` ADD CONSTRAINT `merchant_offers_gift_id_fkey` FOREIGN KEY (`gift_id`) REFERENCES `gifts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `merchant_offers` ADD CONSTRAINT `merchant_offers_product_identity_id_fkey` FOREIGN KEY (`product_identity_id`) REFERENCES `product_identities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `merchant_offers` ADD CONSTRAINT `merchant_offers_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_snapshots` ADD CONSTRAINT `price_snapshots_gift_id_fkey` FOREIGN KEY (`gift_id`) REFERENCES `gifts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_snapshots` ADD CONSTRAINT `price_snapshots_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_gift_id_fkey` FOREIGN KEY (`gift_id`) REFERENCES `gifts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contributions` ADD CONSTRAINT `contributions_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contributions` ADD CONSTRAINT `contributions_gift_id_fkey` FOREIGN KEY (`gift_id`) REFERENCES `gifts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contributions` ADD CONSTRAINT `contributions_reservation_id_fkey` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contributions` ADD CONSTRAINT `contributions_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `affiliate_clicks` ADD CONSTRAINT `affiliate_clicks_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `affiliate_clicks` ADD CONSTRAINT `affiliate_clicks_gift_id_fkey` FOREIGN KEY (`gift_id`) REFERENCES `gifts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `affiliate_clicks` ADD CONSTRAINT `affiliate_clicks_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `affiliate_commissions` ADD CONSTRAINT `affiliate_commissions_click_id_fkey` FOREIGN KEY (`click_id`) REFERENCES `affiliate_clicks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `affiliate_commissions` ADD CONSTRAINT `affiliate_commissions_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reward_wallets` ADD CONSTRAINT `reward_wallets_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reward_transactions` ADD CONSTRAINT `reward_transactions_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `reward_wallets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reward_transactions` ADD CONSTRAINT `reward_transactions_commission_id_fkey` FOREIGN KEY (`commission_id`) REFERENCES `affiliate_commissions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reward_redemptions` ADD CONSTRAINT `reward_redemptions_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `reward_wallets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reward_redemptions` ADD CONSTRAINT `reward_redemptions_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `referrals` ADD CONSTRAINT `referrals_referrer_user_id_fkey` FOREIGN KEY (`referrer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `referrals` ADD CONSTRAINT `referrals_referred_user_id_fkey` FOREIGN KEY (`referred_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `referrals` ADD CONSTRAINT `referrals_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `reward_wallets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `partner_campaigns` ADD CONSTRAINT `partner_campaigns_partner_id_fkey` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_accounts` ADD CONSTRAINT `payment_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_routes` ADD CONSTRAINT `payment_routes_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_routes` ADD CONSTRAINT `payment_routes_payment_account_id_fkey` FOREIGN KEY (`payment_account_id`) REFERENCES `payment_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chargebacks` ADD CONSTRAINT `chargebacks_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_transfers` ADD CONSTRAINT `bank_transfers_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_ledger_entries` ADD CONSTRAINT `financial_ledger_entries_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_ledger_entries` ADD CONSTRAINT `financial_ledger_entries_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_groups` ADD CONSTRAINT `order_groups_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_groups` ADD CONSTRAINT `order_groups_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_group_items` ADD CONSTRAINT `order_group_items_order_group_id_fkey` FOREIGN KEY (`order_group_id`) REFERENCES `order_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_group_items` ADD CONSTRAINT `order_group_items_gift_id_fkey` FOREIGN KEY (`gift_id`) REFERENCES `gifts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_gift_id_fkey` FOREIGN KEY (`gift_id`) REFERENCES `gifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_reservation_id_fkey` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media_assets` ADD CONSTRAINT `media_assets_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media_assets` ADD CONSTRAINT `media_assets_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thank_yous` ADD CONSTRAINT `thank_yous_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thank_yous` ADD CONSTRAINT `thank_yous_gift_id_fkey` FOREIGN KEY (`gift_id`) REFERENCES `gifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thank_yous` ADD CONSTRAINT `thank_yous_reservation_id_fkey` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thank_yous` ADD CONSTRAINT `thank_yous_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reports` ADD CONSTRAINT `reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reports` ADD CONSTRAINT `reports_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_audit_logs` ADD CONSTRAINT `admin_audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `list_entitlements` ADD CONSTRAINT `list_entitlements_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
