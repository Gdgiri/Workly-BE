-- Check if customers exist and their adminId values
SELECT 
    COUNT(*) as total_customers,
    adminId,
    GROUP_CONCAT(DISTINCT name SEPARATOR ', ') as sample_names
FROM customers
GROUP BY adminId;

-- Check specifically for our stylist's business
SELECT COUNT(*) as customer_count
FROM customers
WHERE adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';

-- List first 5 customers for this business
SELECT id, name, email, adminId
FROM customers
WHERE adminId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c'
LIMIT 5;

-- Check if there are any customers at all
SELECT COUNT(*) as total_customers FROM customers;
