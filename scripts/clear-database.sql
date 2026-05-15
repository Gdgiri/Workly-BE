-- Clear Salon Backend Database
-- This script removes all data from salon backend tables while preserving the schema
-- AuthService tables (apps, users, otp_logs, refresh_tokens) are NOT affected

SET FOREIGN_KEY_CHECKS = 0;

-- Clear all salon backend tables (using DELETE to avoid TRUNCATE issues)
DELETE FROM voucher_claims WHERE 1=1;
DELETE FROM vouchers WHERE 1=1;
DELETE FROM reconciliations WHERE 1=1;
DELETE FROM customer_packages WHERE 1=1;
DELETE FROM packages WHERE 1=1;
DELETE FROM inventory_movements WHERE 1=1;
DELETE FROM products WHERE 1=1;
DELETE FROM payments WHERE 1=1;
DELETE FROM sales WHERE 1=1;
DELETE FROM appointments WHERE 1=1;
DELETE FROM customers WHERE 1=1;
DELETE FROM stylists WHERE 1=1;
DELETE FROM services WHERE 1=1;
DELETE FROM categories WHERE 1=1;
DELETE FROM expenses WHERE 1=1;
DELETE FROM settings WHERE 1=1;
DELETE FROM subscriptions WHERE 1=1;
DELETE FROM subscription_plans WHERE 1=1;
DELETE FROM users WHERE 1=1;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Database cleared successfully!' AS status;
