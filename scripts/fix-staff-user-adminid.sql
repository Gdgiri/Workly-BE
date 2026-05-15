-- Check stylist with authId for the STAFF user
SELECT 
    id,
    authId,
    adminId,
    name,
    email,
    CASE 
        WHEN adminId IS NULL THEN '❌ NO BUSINESS LINK'
        ELSE '✅ LINKED'
    END as status
FROM stylists
WHERE authId = '0fb9ccf2-a18c-4a0d-bac4-f43590668efd';

-- If adminId is NULL, update it
UPDATE stylists
SET adminId = (SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1)
WHERE authId = '0fb9ccf2-a18c-4a0d-bac4-f43590668efd'
AND adminId IS NULL;

-- Verify
SELECT id, authId, adminId, name, email
FROM stylists
WHERE authId = '0fb9ccf2-a18c-4a0d-bac4-f43590668efd';
