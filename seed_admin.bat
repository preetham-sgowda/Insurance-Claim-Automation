@echo off
:: ============================================================
::  NexSettle — Seed Admin Account
::  Creates the default admin login in MongoDB
:: ============================================================
title NexSettle — Seed Admin

cd /d "%~dp0backend"

if not exist "venv\" (
    echo [ERROR] Virtual environment not found. Run run.bat first.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

echo.
echo [INFO] Seeding admin account into MongoDB...
python scripts\seed_admin.py
echo.
echo [DONE] Admin seed complete. You can now log in at:
echo        http://localhost:8000 ^> Admin Portal
echo.
pause
