-- Verify what adminId the controller is actually seeing
-- Check the stylist record
SELECT 
    'Stylist Record' as type,
    id,
    authId,
    adminId,
    name,
    email
FROM stylists
WHERE authId = '0fb9ccf2-a18c-4a0d-bac4-f43590668efd';

-- Check what adminId customers actually have
SELECT 
    'Customer AdminIds' as type,
    adminId,
    COUNT(*) as count,
    GROUP_CONCAT(name SEPARATOR ', ') as names
FROM customers
GROUP BY adminId;

-- Check if any customers have the correct adminId
SELECT COUNT(*) as count_with_correct_adminId
FROM customers
WHERE adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';
