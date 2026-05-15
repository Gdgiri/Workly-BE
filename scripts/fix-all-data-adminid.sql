-- Fix: Update ALL data to the CORRECT stylist's adminId
-- Stylist's adminId: 02d6ba2c-9089-4a71-bb89-3e8eb996f93c

-- Step 1: Verify stylist's adminId
SELECT 'Stylist AdminId' as info, adminId 
FROM stylists 
WHERE authId = '0fb9ccf2-a18c-4a0d-bac4-f43590668efd';

-- Step 2: Update ALL tables to use this adminId
UPDATE customers SET adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';
UPDATE services SET adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';
UPDATE products SET adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';
UPDATE packages SET authId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';
UPDATE appointments SET authId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';
UPDATE sales SET authId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';
UPDATE expenses SET authId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';

-- Step 3: Verify counts
SELECT 'Customers' as table_name, COUNT(*) as count FROM customers WHERE adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c'
UNION ALL
SELECT 'Services', COUNT(*) FROM services WHERE adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c'
UNION ALL
SELECT 'Products', COUNT(*) FROM products WHERE adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c'
UNION ALL
SELECT 'Packages', COUNT(*) FROM packages WHERE authId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c'
UNION ALL
SELECT 'Appointments', COUNT(*) FROM appointments WHERE authId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c'
UNION ALL
SELECT 'Sales', COUNT(*) FROM sales WHERE authId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c'
UNION ALL
SELECT 'Expenses', COUNT(*) FROM expenses WHERE authId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';
