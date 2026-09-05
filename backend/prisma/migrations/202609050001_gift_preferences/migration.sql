ALTER TABLE `lists`
  ADD COLUMN `show_gift_images` BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE `gifts`
  ADD COLUMN `priority` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  ADD INDEX `gifts_list_id_priority_position_idx` (`list_id`, `priority`, `position`);

-- Les articles déjà chiffrés deviennent participatifs par défaut. Un objectif NULL
-- reste le choix explicite pour désactiver la cagnotte sur un article.
UPDATE `gifts`
SET `contribution_target_minor` = `unit_price_minor` * `quantity`
WHERE `contribution_target_minor` IS NULL
  AND `unit_price_minor` IS NOT NULL;
