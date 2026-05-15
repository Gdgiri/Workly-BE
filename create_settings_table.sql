-- Create Settings table
CREATE TABLE IF NOT EXISTS `settings` (
  `id` VARCHAR(191) NOT NULL,
  `adminId` VARCHAR(191) NOT NULL,
  `razorpayKeyId` VARCHAR(191) NULL,
  `razorpayKeySecret` VARCHAR(191) NULL,
  `currency` VARCHAR(191) NULL DEFAULT 'INR',
  `salonName` VARCHAR(191) NULL,
  `salonPhone` VARCHAR(191) NULL,
  `salonAddress` TEXT NULL,
  `openingTime` VARCHAR(191) NULL DEFAULT '09:00',
  `closingTime` VARCHAR(191) NULL DEFAULT '18:00',
  `maxAdvanceBookingDays` INT NULL DEFAULT 30,
  `cancellationPolicyHours` INT NULL DEFAULT 24,
  `whatsappNotifications` BOOLEAN NOT NULL DEFAULT false,
  `activePaymentMethods` VARCHAR(191) NULL DEFAULT 'CASH,CARD,UPI',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `settings_adminId_key`(`adminId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
