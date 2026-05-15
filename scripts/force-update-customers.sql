-- Force update ALL customers to correct adminId (override unique constraint)
DELETE c1 FROM customers c1
INNER JOIN customers c2 
WHERE c1.id > c2.id AND c1.email = c2.email;

-- Now forcefully update
UPDATE customers 
SET adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c'
WHERE adminId != '02d6ba2c-9089-4a71-bb89-3e8eb996f93c' OR adminId IS NULL;
