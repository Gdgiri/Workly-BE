-- Handle duplicate emails when updating customers
-- Delete duplicate customers keeping only the first one

-- Step 1: Find duplicates
SELECT email, COUNT(*) as count
FROM customers
GROUP BY email
HAVING COUNT(*) > 1;

-- Step 2: Keep only the first customer for each email, delete the rest
DELETE c1 FROM customers c1
INNER JOIN customers c2 
WHERE c1.id > c2.id 
AND c1.email = c2.email;

-- Step 3: Now update all customers to the business adminId
UPDATE customers 
SET adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';

-- Step 4: Verify
SELECT COUNT(*), adminId FROM customers GROUP BY adminId;
