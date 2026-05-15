# 🔧 Database Setup Guide

## Issue: DATABASE_URL Environment Variable

The error you're seeing indicates that Prisma cannot read the `DATABASE_URL` from your `.env` file.

## Solution Steps

### 1. Fix the .env file

Your `.env` file needs to have the DATABASE_URL in this exact format (all on one line):

```env
DATABASE_URL="mysql://username:password@host:port/database_name"
```

**Example:**
```env
DATABASE_URL="mysql://root:mypassword@localhost:3306/workly_saloon"
```

### 2. Common Issues

- ✅ **Use double quotes** around the URL
- ✅ **No line breaks** in the DATABASE_URL value
- ✅ **No spaces** around the `=` sign
- ✅ Make sure the database exists or Prisma can create it

### 3. Manual Setup Commands

Run these commands **one at a time** in PowerShell:

```powershell
# Step 1: Generate Prisma Client
npx prisma generate

# Step 2: Push schema to database (creates tables)
npx prisma db push

# Step 3: Seed the database
npm run prisma:seed

# Step 4: Run tests
npm test

# Step 5: Start the server
npm run dev
```

### 4. Alternative: Use the setup script

```powershell
.\setup.ps1
```

### 5. Verify Database Connection

Test if Prisma can connect:

```powershell
npx prisma db pull
```

This will try to read your database schema. If it works, your connection is good!

### 6. Create Database Manually (if needed)

If your database doesn't exist, create it first:

```sql
CREATE DATABASE workly_saloon CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Example .env File

See `.env.template` for a clean example. Copy it to `.env` and update with your actual database credentials:

```powershell
Copy-Item .env.template .env
```

Then edit `.env` with your actual database URL.

## Need Help?

Make sure:
1. MySQL is running
2. The database user has proper permissions
3. The database exists (or Prisma has permission to create it)
4. No firewall blocking the connection
5. The .env file is in the project root directory
