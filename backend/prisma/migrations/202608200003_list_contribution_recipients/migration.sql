ALTER TABLE `lists` ADD COLUMN `contribution_recipient_id` CHAR(36) NULL;

UPDATE `lists`
SET `contribution_recipient_id` = `owner_id`
WHERE `contribution_recipient_id` IS NULL;

ALTER TABLE `lists` MODIFY `contribution_recipient_id` CHAR(36) NOT NULL;
ALTER TABLE `lists` ADD INDEX `lists_contribution_recipient_id_idx` (`contribution_recipient_id`);
ALTER TABLE `lists` ADD CONSTRAINT `lists_contribution_recipient_id_fkey`
  FOREIGN KEY (`contribution_recipient_id`) REFERENCES `users` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `transfer_instructions` ADD COLUMN `recipient_user_id` CHAR(36) NULL;

UPDATE `transfer_instructions` AS `instruction`
INNER JOIN `bank_transfers` AS `transfer` ON `transfer`.`id` = `instruction`.`bank_transfer_id`
INNER JOIN `lists` AS `list` ON `list`.`id` = `transfer`.`list_id`
SET `instruction`.`recipient_user_id` = `list`.`owner_id`
WHERE `instruction`.`recipient_user_id` IS NULL;

ALTER TABLE `transfer_instructions` MODIFY `recipient_user_id` CHAR(36) NOT NULL;
ALTER TABLE `transfer_instructions` ADD INDEX `transfer_instructions_recipient_user_id_idx` (`recipient_user_id`);
ALTER TABLE `transfer_instructions` ADD CONSTRAINT `transfer_instructions_recipient_user_id_fkey`
  FOREIGN KEY (`recipient_user_id`) REFERENCES `users` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
