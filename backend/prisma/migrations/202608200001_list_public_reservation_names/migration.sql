ALTER TABLE `lists`
    ADD COLUMN `show_reservation_names` BOOLEAN NOT NULL DEFAULT false AFTER `hide_reserved_gifts`;
