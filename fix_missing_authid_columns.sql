-- =====================================================
-- COMPREHENSIVE AUTH_ID MIGRATION SCRIPT
-- =====================================================
-- Purpose: Add missing authId columns to all tables
-- Database: saloon_db (Railway MySQL)
-- Safe: Uses IF NOT EXISTS to prevent errors
-- =====================================================

-- 1. SERVICES TABLE
-- Add authId column if it doesn't exist
ALTER TABLE `services` 
ADD COLUMN IF NOT EXISTS `authId` VARCHAR(191) NULL AFTER `id`;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS `services_authId_idx` ON `services`(`authId`);

-- 2. APPOINTMENTS TABLE
-- Add authId column if it doesn't exist
ALTER TABLE `appointments` 
ADD COLUMN IF NOT EXISTS `authId` VARCHAR(191) NULL AFTER `id`;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS `appointments_authId_idx` ON `appointments`(`authId`);

-- 3. PRODUCTS TABLE
-- Add authId column if it doesn't exist
ALTER TABLE `products` 
ADD COLUMN IF NOT EXISTS `authId` VARCHAR(191) NULL AFTER `id`;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS `products_authId_idx` ON `products`(`authId`);

-- 4. PACKAGES TABLE
-- Add authId column if it doesn't exist
ALTER TABLE `packages` 
ADD COLUMN IF NOT EXISTS `authId` VARCHAR(191) NULL AFTER `id`;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS `packages_authId_idx` ON `packages`(`authId`);

-- 5. EXPENSES TABLE
-- Add authId column if it doesn't exist
ALTER TABLE `expenses` 
ADD COLUMN IF NOT EXISTS `authId` VARCHAR(191) NULL AFTER `id`;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS `expenses_authId_idx` ON `expenses`(`authId`);

-- 6. PAYMENTS TABLE
-- Add authId column if it doesn't exist
ALTER TABLE `payments` 
ADD COLUMN IF NOT EXISTS `authId` VARCHAR(191) NULL AFTER `id`;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS `payments_authId_idx` ON `payments`(`authId`);

-- 7. SALES TABLE (may already exist from earlier migration)
-- Add authId column if it doesn't exist
ALTER TABLE `sales` 
ADD COLUMN IF NOT EXISTS `authId` VARCHAR(191) NULL AFTER `id`;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS `sales_authId_idx` ON `sales`(`authId`);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these after migration to verify success:

-- Check all tables have authId column
-- SELECT 
--   TABLE_NAME,
--   COLUMN_NAME,
--   COLUMN_TYPE,
--   IS_NULLABLE
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA = 'saloon_db'
--   AND COLUMN_NAME = 'authId'
-- ORDER BY TABLE_NAME;

-- Expected output: Should show authId in:
-- appointments, customers, expenses, packages, payments, products, sales, services, stylists

-- =====================================================
-- NOTES
-- =====================================================
-- - All columns are nullable (NULL) to allow existing records
-- - Indexes added for performance (matching Prisma schema)
-- - IF NOT EXISTS prevents errors if already run
-- - Non-destructive: Won't delete or modify existing data
-- =====================================================
