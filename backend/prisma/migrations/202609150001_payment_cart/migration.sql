ALTER TABLE `contributions` DROP FOREIGN KEY `contributions_payment_id_fkey`;
ALTER TABLE `contributions` DROP INDEX `contributions_payment_id_key`;
CREATE INDEX `contributions_payment_id_idx` ON `contributions`(`payment_id`);
ALTER TABLE `contributions` ADD CONSTRAINT `contributions_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
