# Instructions for Database Owner

## 📧 Send This to the Person Who Created the Railway Database

---

### **Subject: Need Database Schema Update - Add Missing Columns**

Hi,

I need to add `authId` columns to our saloon_db database tables. This is required for the application to track which admin created each record.

### **Quick Summary:**
- **Time needed**: 2 minutes
- **Risk**: None (just adding columns, not deleting anything)
- **Database**: saloon_db on Railway
- **Tables affected**: 7 tables (services, appointments, products, packages, expenses, payments, sales)

---

### **Option 1: Copy-Paste SQL (Easiest)**

Login to Railway → MySQL Database → Query Tab → Paste this:

```sql
-- Add authId columns (safe - won't delete any data)
ALTER TABLE services ADD COLUMN IF NOT EXISTS authId VARCHAR(191) NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS authId VARCHAR(191) NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS authId VARCHAR(191) NULL;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS authId VARCHAR(191) NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS authId VARCHAR(191) NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS authId VARCHAR(191) NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS authId VARCHAR(191) NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS services_authId_idx ON services(authId);
CREATE INDEX IF NOT EXISTS appointments_authId_idx ON appointments(authId);
CREATE INDEX IF NOT EXISTS products_authId_idx ON products(authId);
CREATE INDEX IF NOT EXISTS packages_authId_idx ON packages(authId);
CREATE INDEX IF NOT EXISTS expenses_authId_idx ON expenses(authId);
CREATE INDEX IF NOT EXISTS payments_authId_idx ON payments(authId);
CREATE INDEX IF NOT EXISTS sales_authId_idx ON sales(authId);
```

**Then click Execute.**

---

### **Option 2: Run SQL File**

If you have MySQL client installed:

```bash
mysql -h maglev.proxy.rlwy.net -P 22744 -u root -p saloon_db < fix_missing_authid_columns.sql
```

*(The file fix_missing_authid_columns.sql is attached)*

---

### **Verify Success:**

After running, execute this to confirm:

```sql
SELECT TABLE_NAME, COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'saloon_db' 
  AND COLUMN_NAME = 'authId' 
ORDER BY TABLE_NAME;
```

**Expected result**: Should show 9 tables with authId column:
- appointments
- customers
- expenses
- packages
- payments
- products
- sales
- services
- stylists

---

### **Why This is Needed:**

The Prisma schema has `authId` defined, but it was never added to the actual database tables. This causes errors when admins try to create services, products, etc.

After this update:
- ✅ Application will automatically track which admin created each record
- ✅ No more database errors
- ✅ Audit trail for all records

---

### **Safety Notes:**

- ✅ Uses `IF NOT EXISTS` - won't break if column already exists
- ✅ Non-destructive - doesn't delete or modify existing data
- ✅ Nullable columns - existing records won't be affected
- ✅ Takes ~5 seconds to execute

---

**Let me know once this is done!**

Thanks!
