-- Add authId to appointments and services tables
ALTER TABLE `appointments` ADD COLUMN `authId` VARCHAR(191) NULL AFTER `id`;
ALTER TABLE `services` ADD COLUMN `authId` VARCHAR(191) NULL AFTER `id`;

-- Add indexes for efficient lookups
CREATE INDEX `appointments_authId_idx` ON `appointments`(`authId`);
CREATE INDEX `services_authId_idx` ON `services`(`authId`);
