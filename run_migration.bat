@echo off
REM =====================================================
REM Railway MySQL Migration Execution Script
REM =====================================================
REM This script will execute the authId migration on Railway database
REM Make sure you have MySQL client installed
REM =====================================================

echo ======================================================
echo    Railway MySQL - AuthId Migration Script
echo ======================================================
echo.
echo This script will:
echo  1. Connect to Railway MySQL database
echo  2. Execute fix_missing_authid_columns.sql
echo  3. Verify migration success
echo.
echo Database: maglev.proxy.rlwy.net:22744
echo Database Name: saloon_db
echo.

REM Prompt for MySQL root password
set /p MYSQL_PASSWORD="Enter MySQL root password: "

echo.
echo ======================================================
echo Step 1: Testing database connection...
echo ======================================================
mysql -h maglev.proxy.rlwy.net -P 22744 -u root -p%MYSQL_PASSWORD% -e "SELECT VERSION();" saloon_db
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to connect to database!
    echo Please check your credentials and try again.
    pause
    exit /b 1
)

echo.
echo Connection successful!
echo.
echo ======================================================
echo Step 2: Executing migration script...
echo ======================================================
mysql -h maglev.proxy.rlwy.net -P 22744 -u root -p%MYSQL_PASSWORD% saloon_db < fix_missing_authid_columns.sql
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Migration failed!
    pause
    exit /b 1
)

echo.
echo Migration executed successfully!
echo.
echo ======================================================
echo Step 3: Verifying migration...
echo ======================================================
mysql -h maglev.proxy.rlwy.net -P 22744 -u root -p%MYSQL_PASSWORD% saloon_db -e "SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'saloon_db' AND COLUMN_NAME = 'authId' ORDER BY TABLE_NAME;"

echo.
echo ======================================================
echo Migration completed successfully!
echo ======================================================
echo.
echo Next steps:
echo  1. Restart your backend server
echo  2. Test creating a new service
echo  3. Verify authId is populated
echo.
pause
