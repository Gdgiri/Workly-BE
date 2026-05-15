-- Make stylistId nullable in appointments table
ALTER TABLE `appointments` MODIFY COLUMN `stylistId` VARCHAR(191) NULL;
