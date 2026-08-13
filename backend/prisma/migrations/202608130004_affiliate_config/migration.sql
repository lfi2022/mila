ALTER TABLE `merchants`
  ADD COLUMN `affiliate_link_template` VARCHAR(2048) NULL,
  ADD COLUMN `affiliate_rules` JSON NULL;
