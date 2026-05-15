-- Check today's sales in database
-- Current user adminId: be9be1e7-f338-4c94-8887-4027928e1833

-- 1. Check all sales with their authId and timestamps
SELECT 
    id,
    saleNumber,
    authId,
    totalAmount,
    paidAmount,
    balanceAmount,
    createdAt,
    DATE(createdAt) as sale_date
FROM sales
ORDER BY createdAt DESC
LIMIT 10;

-- 2. Check sales for this specific adminId
SELECT 
    id,
    saleNumber,
    authId,
    totalAmount,
    createdAt,
    DATE(createdAt) as sale_date
FROM sales
WHERE authId = 'be9be1e7-f338-4c94-8887-4027928e1833'
ORDER BY createdAt DESC;

-- 3. Check what date range the query is using (UTC)
-- Today in UTC should be 2026-01-11 00:00:00
SELECT 
    id,
    saleNumber,
    totalAmount,
    createdAt,
    DATE(createdAt) as sale_date,
    authId
FROM sales
WHERE createdAt >= '2026-01-11 00:00:00'
  AND createdAt < '2026-01-12 00:00:00'
ORDER BY createdAt DESC;

-- 4. Check ALL sales created today (any authId)
SELECT 
    COUNT(*) as total_sales_today,
    SUM(totalAmount) as total_amount_today
FROM sales
WHERE DATE(createdAt) = CURDATE();

-- 5. Get the actual current UTC date/time from database
SELECT NOW() as server_time, UTC_TIMESTAMP() as utc_time, CURDATE() as current_date;
