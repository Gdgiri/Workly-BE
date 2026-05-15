-- Verify stylist adminId status
SELECT 
    id,
    name,
    email,
    authId,
    adminId,
    CASE 
        WHEN adminId IS NULL THEN '❌ NULL - ISSUE'
        ELSE '✅ HAS VALUE'
    END as status
FROM stylists
ORDER BY adminId IS NULL DESC;

-- Check if there are any NULL values
SELECT COUNT(*) as null_count
FROM stylists  
WHERE adminId IS NULL;
