-- CreateTable
CREATE TABLE `reconciliation_audits` (
    `id` VARCHAR(191) NOT NULL,
    `authId` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NOT NULL,
    `attemptTimestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `attemptType` ENUM('CALCULATE', 'SAVE', 'UPDATE', 'DELETE') NOT NULL,
    `attemptStatus` ENUM('SUCCESS', 'FAILED', 'PARTIAL') NOT NULL DEFAULT 'SUCCESS',
    `errorMessage` TEXT NULL,
    `errorCode` VARCHAR(191) NULL,
    `inputData` JSON NOT NULL,
    `calculatedResults` JSON NOT NULL,
    `discrepancyAmount` DOUBLE NULL,
    `discrepancyType` VARCHAR(191) NULL,
    `reconciliationId` VARCHAR(191) NULL,
    `userName` VARCHAR(191) NULL,
    `userRole` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `requestId` VARCHAR(191) NULL,
    `duration` INTEGER NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,
    `deletionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `reconciliation_audits_authId_idx`(`authId`),
    INDEX `reconciliation_audits_adminId_idx`(`adminId`),
    INDEX `reconciliation_audits_reconciliationId_idx`(`reconciliationId`),
    INDEX `reconciliation_audits_attemptTimestamp_idx`(`attemptTimestamp`),
    INDEX `reconciliation_audits_attemptType_idx`(`attemptType`),
    INDEX `reconciliation_audits_attemptStatus_idx`(`attemptStatus`),
    INDEX `reconciliation_audits_isDeleted_idx`(`isDeleted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `reconciliation_audits` ADD CONSTRAINT `reconciliation_audits_reconciliationId_fkey` FOREIGN KEY (`reconciliationId`) REFERENCES `reconciliations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
