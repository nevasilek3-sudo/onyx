@echo off
echo Creating database and running migration...
psql -U postgres -c "CREATE DATABASE appleskin;" 2>nul
psql -U postgres -d appleskin -f migrations\init.sql
echo.
echo Installing dependencies...
call npm install
echo.
echo Done! Run 'npm start' to launch the server.
pause
