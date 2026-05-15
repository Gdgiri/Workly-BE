-- Add authId to packages, expenses, and payments tables
ALTER TABLE `packages` ADD COLUMN `authId` VARCHAR(191) NULL AFTER `id`;
ALTER TABLE `expenses` ADD COLUMN `authId` VARCHAR(191) NULL AFTER `id`;
ALTER TABLE `payments` ADD COLUMN `authId` VARCHAR(191) NULL AFTER `id`;

-- Add indexes for efficient lookups
CREATE INDEX `packages_authId_idx` ON `packages`(`authId`);
CREATE INDEX `expenses_authId_idx` ON `expenses`(`authId`);
CREATE INDEX `payments_authId_idx` ON `payments`(`authId`);
