@echo off
echo Stopping any running servers on port 5000...
FOR /F "tokens=5" %%P IN ('netstat -a -n -o ^| findstr :5000') DO TaskKill.exe /F /PID %%P 2>nul

echo.
echo Regenerating Prisma Client...
call npx prisma generate --schema=./prisma/schema.prisma

echo.
echo Starting server...
call npm run dev
