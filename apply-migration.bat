@echo off
echo Creating migration and applying it...
echo.

REM Create timestamp
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set timestamp=%mydate%_%mytime: =0%

REM Create migration directory
set migrationDir=prisma\migrations\%timestamp%_add_reconciliation_audit
mkdir "%migrationDir%"

REM Create migration SQL file
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

echo Migration file created!
echo.
echo Applying migration...
call npx prisma migrate deploy
echo.
echo Generating Prisma Client...
call npx prisma generate
echo.
echo ========================================
echo Migration Complete!
echo ========================================
echo.
echo Now restart your server: npm run dev
echo.
pause
