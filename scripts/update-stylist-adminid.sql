UPDATE stylists 
SET adminId = (SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1)
WHERE adminId IS NULL;
