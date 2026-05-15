-- Add cancellationReason column to appointments table
ALTER TABLE `railway`.`appointments` 
ADD COLUMN `cancellationReason` TEXT NULL AFTER `notes`;

-- Verify the column was added
DESCRIBE `railway`.`appointments`;
