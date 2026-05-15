UPDATE stylists
SET adminId = (SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1)
WHERE authId = '0fb9ccf2-a18c-4a0d-bac4-f43590668efd';
