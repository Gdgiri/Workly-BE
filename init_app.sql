-- Initialize workly-salon app in AuthService
-- Run this SQL in your AuthService database (Railway database on port 42583)

INSERT INTO apps (id, name, description, created_at, updated_at) 
VALUES (
    '550e8400-e29b-41d4-a716-446655440000', 
    'workly-salon', 
    'Workly Salon Management System', 
    NOW(), 
    NOW()
);

-- Verify the app was created
SELECT * FROM apps WHERE name = 'workly-salon';
