@echo off
echo ========================================
echo  Reconciliation Audit Migration Script
echo ========================================
echo.

cd /d "%~dp0"

echo Step 1: Creating migration directory...
set timestamp=%date:~-4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set timestamp=%timestamp: =0%
set migrationDir=prisma\migrations\%timestamp%_add_reconciliation_audit
mkdir "%migrationDir%" 2>nul
echo    Created: %migrationDir%
echo.

echo Step 2: Creating migration SQL file...
(
echo -- CreateTable
echo CREATE TABLE `reconciliation_audits` ^(
echo     `id` VARCHAR^(191^) NOT NULL,
echo     `authId` VARCHAR^(191^) NOT NULL,
echo     `adminId` VARCHAR^(191^) NOT NULL,
echo     `attemptTimestamp` DATETIME^(3^) NOT NULL DEFAULT CURRENT_TIMESTAMP^(3^),
echo     `attemptType` ENUM^('CALCULATE', 'SAVE', 'UPDATE', 'DELETE'^) NOT NULL,
echo     `attemptStatus` ENUM^('SUCCESS', 'FAILED', 'PARTIAL'^) NOT NULL DEFAULT 'SUCCESS',
echo     `errorMessage` TEXT NULL,
echo     `errorCode` VARCHAR^(191^) NULL,
echo     `inputData` JSON NOT NULL,
echo     `calculatedResults` JSON NOT NULL,
echo     `discrepancyAmount` DOUBLE NULL,
echo     `discrepancyType` VARCHAR^(191^) NULL,
echo     `reconciliationId` VARCHAR^(191^) NULL,
echo     `userName` VARCHAR^(191^) NULL,
echo     `userRole` VARCHAR^(191^) NULL,
echo     `ipAddress` VARCHAR^(191^) NULL,
echo     `userAgent` VARCHAR^(191^) NULL,
echo     `sessionId` VARCHAR^(191^) NULL,
echo     `requestId` VARCHAR^(191^) NULL,
echo     `duration` INTEGER NULL,
echo     `isDeleted` BOOLEAN NOT NULL DEFAULT false,
echo     `deletedAt` DATETIME^(3^) NULL,
echo     `deletedBy` VARCHAR^(191^) NULL,
echo     `deletionReason` TEXT NULL,
echo     `createdAt` DATETIME^(3^) NOT NULL DEFAULT CURRENT_TIMESTAMP^(3^),
echo     `updatedAt` DATETIME^(3^) NOT NULL,
echo     INDEX `reconciliation_audits_authId_idx`^(`authId`^),
echo     INDEX `reconciliation_audits_adminId_idx`^(`adminId`^),
echo     INDEX `reconciliation_audits_reconciliationId_idx`^(`reconciliationId`^),
echo     INDEX `reconciliation_audits_attemptTimestamp_idx`^(`attemptTimestamp`^),
echo     INDEX `reconciliation_audits_attemptType_idx`^(`attemptType`^),
echo     INDEX `reconciliation_audits_attemptStatus_idx`^(`attemptStatus`^),
echo     INDEX `reconciliation_audits_isDeleted_idx`^(`isDeleted`^),
echo     PRIMARY KEY ^(`id`^)
echo ^) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
echo.
echo -- AddForeignKey
echo ALTER TABLE `reconciliation_audits` ADD CONSTRAINT `reconciliation_audits_reconciliationId_fkey` FOREIGN KEY ^(`reconciliationId`^) REFERENCES `reconciliations`^(`id`^) ON DELETE SET NULL ON UPDATE CASCADE;
) > "%migrationDir%\migration.sql"
echo    Created: migration.sql
echo.

echo Step 3: Applying migration to database...
call npx prisma migrate deploy
echo.

echo Step 4: Generating Prisma Client...
call npx prisma generate
echo.

echo ========================================
echo  Migration Complete!
echo ========================================
echo.
echo Next steps:
echo   1. Restart your backend server (Ctrl+C, then 'npm run dev'^)
echo   2. Navigate to: /{appId}/{businessName}/reconciliation-audits
echo   3. Create a reconciliation to test audit logging
echo.
pause
