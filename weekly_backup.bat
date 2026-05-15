@echo off

:: Get date in YYYY-MM-DD format
for /f %%i in ('wmic os get localdatetime ^| find "."') do set dt=%%i
set DATE=%dt:~0,4%-%dt:~4,2%-%dt:~6,2%

"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" ^
-h interchange.proxy.rlwy.net ^
-P 56903 ^
-u root ^
-pcypBJpTHWZLTiISxsLLeppyDJQQNVfeF ^
railway > "C:\mysql-backups\railway_backup_%DATE%.sql"
