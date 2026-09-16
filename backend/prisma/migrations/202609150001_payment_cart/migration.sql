ALTER TABLE `contributions` DROP INDEX `contributions_payment_id_key`;
CREATE INDEX `contributions_payment_id_idx` ON `contributions`(`payment_id`);
