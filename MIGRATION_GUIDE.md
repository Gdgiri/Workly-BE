# Migration Guide: Fix Missing AuthId Columns

## 🎯 Objective

Add `authId` column to all database tables that are missing it.

## 📋 Pre-Migration Checklist

- [ ] Backup your Railway database (recommended)
- [ ] Have database credentials ready
- [ ] Review the SQL script: `fix_missing_authid_columns.sql`

---

## 🔍 Step 1: Verify Current State

Connect to your Railway MySQL database and check which tables have `authId`:

```sql
SELECT 
  TABLE_NAME,
  COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'saloon_db'
  AND COLUMN_NAME = 'authId'
ORDER BY TABLE_NAME;
```

**Expected Result**: Currently shows authId only in `customers` and `stylists`

---

## ⚙️ Step 2: Execute Migration

### Option A: Railway Console (RECOMMENDED)

1. Go to Railway Dashboard: https://railway.app
2. Select your MySQL database
3. Click on "Query" or "Connect" tab
4. Open the file: `fix_missing_authid_columns.sql`
5. Copy all SQL content
6. Paste into Railway SQL editor
7. Execute the script

### Option B: MySQL Command Line

```bash
# Connect to database
mysql -h maglev.proxy.rlwy.net -P 22744 -u root -p saloon_db

# Run the migration script
source fix_missing_authid_columns.sql;

# Or pipe the file directly
mysql -h maglev.proxy.rlwy.net -P 22744 -u root -p saloon_db < fix_missing_authid_columns.sql
```

### Option C: Database GUI Tool

Use TablePlus, MySQL Workbench, or DBeaver:
1. Connect to Railway MySQL
2. Open `fix_missing_authid_columns.sql`
3. Execute the script

---

## ✅ Step 3: Verify Migration Success

Run this query to confirm all tables now have `authId`:

```sql
SELECT 
  TABLE_NAME,
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'saloon_db'
  AND COLUMN_NAME = 'authId'
ORDER BY TABLE_NAME;
```

**Expected Result**: Should show authId in these tables:
- ✅ appointments
- ✅ customers
- ✅ expenses
- ✅ packages
- ✅ payments
- ✅ products
- ✅ sales
- ✅ services
- ✅ stylists

---

## 🧪 Step 4: Test Application

### Backend Test

1. Start your backend:
   ```bash
   cd Salon-Backend
   npm run dev
   ```

2. Create a test service (use admin JWT token):
   ```bash
   curl -X POST http://localhost:5000/api/v1/services \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name": "Test Service", "duration": 30, "price": 100}'
   ```

3. Check backend console logs for:
   ```
   ✅ Service created successfully with authId: <your-user-id>
   ```

4. Verify in database:
   ```sql
   SELECT id, authId, name FROM services ORDER BY createdAt DESC LIMIT 5;
   ```
   
   Should show the `authId` populated for new services.

### Admin Frontend Test

1. Login to admin panel
2. Create a new service
3. Check database - verify authId is saved

---

## 📊 What This Migration Does

| Table | Change | Impact |
|-------|--------|--------|
| services | Adds authId column + index | Tracks which admin created service |
| appointments | Adds authId column + index | Tracks which user booked |
| products | Adds authId column + index | Tracks which admin created product |
| packages | Adds authId column + index | Updates null to have column |
| expenses | Adds authId column + index | Tracks who recorded expense |
| payments | Adds authId column + index | Tracks who processed payment |
| sales | Adds authId column + index | Tracks who created sale |

---

## ⚠️ Important Notes

1. **Existing Data**: All existing records will have `authId = NULL` (this is expected)
2. **New Records**: Will automatically get authId from JWT token
3. **Optional Field**: authId is nullable, so app won't break if token is missing
4. **Indexes**: Created for performance (faster queries on authId)

---

## 🔄 Rollback (if needed)

If something goes wrong, you can remove the columns:

```sql
-- WARNING: This will delete authId data!
ALTER TABLE services DROP COLUMN authId;
ALTER TABLE appointments DROP COLUMN authId;
ALTER TABLE products DROP COLUMN authId;
ALTER TABLE packages DROP COLUMN authId;
ALTER TABLE expenses DROP COLUMN authId;
ALTER TABLE payments DROP COLUMN authId;
ALTER TABLE sales DROP COLUMN authId;
```

**Note**: Only use rollback if absolutely necessary. It's better to fix issues forward.

---

## 🎉 Success Criteria

Migration is successful when:
- [ ] All 7 tables have authId column
- [ ] Indexes are created
- [ ] New records get authId populated automatically
- [ ] No errors in backend console
- [ ] Application functions normally

---

## 🆘 Troubleshooting

### Error: "Duplicate column name 'authId'"

**Cause**: Column already exists  
**Solution**: This is fine! The script uses `IF NOT EXISTS` to handle this

### Error: "Access denied"

**Cause**: Database user doesn't have ALTER permission  
**Solution**: Use root user credentials from Railway

### authId is still NULL for new records

**Cause**: 
1. Frontend not sending JWT token
2. Auth middleware not running
3. req.user not populated

**Solution**: 
1. Check request headers include `Authorization: Bearer <token>`
2. Verify auth middleware is applied to routes
3. Check backend logs for user extraction

---

## ✉️ Support

If you encounter issues, check:
1. Railway database connection
2. MySQL version compatibility
3. Backend console logs
4. Network connectivity

---

**Migration created**: 2025-12-22  
**Database**: saloon_db (Railway MySQL)  
**Safe to run**: Yes (non-destructive)
