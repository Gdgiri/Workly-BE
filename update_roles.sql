-- Update roles for existing stylists in AuthService database
-- Run this SQL in AuthService Prisma Studio (port 5556)

-- Update specific stylists by their authId
UPDATE users 
SET role = 'EMPLOYEE' 
WHERE id IN (
    '69440f85-a1e3-493b-ad27-6bc0ad8e6d75',  -- faa@gmail.com
    '7c856588-0697-4c8f-bb4d-894bb48a3bbc',  -- asjd@gmail.com
    '7f444aaf-e684-46bd-b597-072e4fa3d00d',  -- gra@gmail.com
    'ae63914d-0373-446f-b071-c73ee0c8b649',  -- kiokk@gmail.com
    'd8c1e84a-6a80-49d6-862d-ce994f568311'   -- aa@gmail.com
);

-- Verify the update
SELECT id, email, role FROM users WHERE role = 'EMPLOYEE';
