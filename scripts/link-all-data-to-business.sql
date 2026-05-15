-- ===========================================
-- FIX: Link All Data to Stylist's Business
-- ===========================================
-- This links all existing data to the stylist's business
-- AdminId: 02d6ba2c-9089-4a71-bb89-3e8eb996f93c

-- Step 1: Verify stylist's adminId
SELECT 
    'Stylist Info' as info,
    id,
    authId,
    adminId,
    name,
    email
FROM stylists
WHERE authId = '0fb9ccf2-a18c-4a0d-bac4-f43590668efd';

-- Step 2: Check current data count
SELECT 'Current' as status,
    (SELECT COUNT(*) FROM customers WHERE adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c') as customers,
    (SELECT COUNT(*) FROM services WHERE adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c') as services,
    (SELECT COUNT(*) FROM products WHERE adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c') as products,
    (SELECT COUNT(*) FROM packages WHERE authId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c') as packages,
    (SELECT COUNT(*) FROM appointments WHERE authId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c') as appointments;

-- Step 3: Link ALL existing data to this business
-- WARNING: This will assign ALL data to this one business!
-- Only run if you want all data visible to this stylist

UPDATE customers 
SET adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';

UPDATE services 
SET adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';

UPDATE products 
SET adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';

UPDATE packages 
SET authId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';

UPDATE appointments 
SET authId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';

-- Step 4: Verify after update
SELECT 'After Update' as status,
    (SELECT COUNT(*) FROM customers WHERE adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c') as customers,
    (SELECT COUNT(*) FROM services WHERE adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c') as services,
    (SELECT COUNT(*) FROM products WHERE adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c') as products,
    (SELECT COUNT(*) FROM packages WHERE authId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c') as packages,
    (SELECT COUNT(*) FROM appointments WHERE authId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c') as appointments;
