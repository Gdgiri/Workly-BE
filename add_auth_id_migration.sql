-- Migration: add_auth_id_fields
-- Description: Add authId columns to customers, stylists, and sales tables

-- AlterTable: Add authId to customers
ALTER TABLE `customers` ADD COLUMN `authId` VARCHAR(191) NULL;

-- AlterTable: Add authId to stylists  
ALTER TABLE `stylists` ADD COLUMN `authId` VARCHAR(191) NULL;

-- AlterTable: Add authId to sales
ALTER TABLE `sales` ADD COLUMN `authId` VARCHAR(191) NULL;

-- CreateIndex: Index on customers.authId
CREATE INDEX `customers_authId_idx` ON `customers`(`authId`);

-- CreateIndex: Index on stylists.authId
CREATE INDEX `stylists_authId_idx` ON `stylists`(`authId`);

-- CreateIndex: Index on sales.authId
CREATE INDEX `sales_authId_idx` ON `sales`(`authId`);
