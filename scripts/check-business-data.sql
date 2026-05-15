-- Check the stylist's adminId
SELECT id, authId, adminId, name, email 
FROM stylists 
WHERE authId = '0fb9ccf2-a18c-4a0d-bac4-f43590668efd';

-- Check if there's any data for this business (adminId: 02d6ba2c-9089-4a71-bb89-3e8eb996f93c)
-- Based on the backend logs, this is the adminId for the STAFF user

-- Check customers
SELECT COUNT(*) as customer_count, adminId
FROM customers
GROUP BY adminId;

-- Check services  
SELECT COUNT(*) as service_count, authId, adminId
FROM services
GROUP BY authId, adminId;

-- Check products
SELECT COUNT(*) as product_count, authId, adminId
FROM products
GROUP BY authId, adminId;

-- Check packages
SELECT COUNT(*) as package_count, authId
FROM packages
GROUP BY authId;

-- Check appointments
SELECT COUNT(*) as appointment_count, authId
FROM appointments
GROUP BY authId;
