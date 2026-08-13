ALTER TABLE `list_entitlements`
  ADD COLUMN `payment_id` CHAR(36) NULL,
  ADD UNIQUE KEY `list_entitlements_payment_id_key` (`payment_id`),
  ADD CONSTRAINT `list_entitlements_payment_id_fkey`
    FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
