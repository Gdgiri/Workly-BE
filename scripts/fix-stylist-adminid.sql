-- ============================================
-- CRITICAL FIX: Link Stylists to Business
-- ============================================
-- This fixes the 403 "Business context required" error
-- by setting adminId for all stylists

-- Step 1: Check current state
SELECT 
    id,
    name, 
    email,
    adminId,
    CASE 
        WHEN adminId IS NULL THEN '❌ NO BUSINESS'
        ELSE '✅ HAS BUSINESS'
    END as status
FROM stylists;

-- Step 2: Get available admin users
SELECT 
    id,
    email,
    role
FROM users 
WHERE role = 'ADMIN';

-- Step 3: Link all stylists to first admin
-- (Adjust the WHERE clause if you have multiple businesses)
UPDATE stylists 
SET adminId = (
    SELECT id 
    FROM users 
    WHERE role = 'ADMIN' 
    LIMIT 1
)
WHERE adminId IS NULL;

-- Step 4: Verify all stylists now have adminId
SELECT 
    id,
    name,
    email,
    adminId
FROM stylists
WHERE adminId IS NULL;

-- Should return 0 rows if successful
