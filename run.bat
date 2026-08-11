@echo off
:: ============================================================
::  NexSettle — Windows Quick Start Script
::  Starts the Django backend for local development
:: ============================================================

title NexSettle Backend

echo.
echo  ███╗   ██╗███████╗██╗  ██╗███████╗███████╗████████╗████████╗██╗     ███████╗
echo  ████╗  ██║██╔════╝╚██╗██╔╝███╔════╝███╔════╝╚══██╔══╝╚══██╔══╝██║     ██╔════╝
echo  ██╔██╗ ██║█████╗   ╚███╔╝ ███████╗ █████╗      ██║      ██║   ██║     █████╗
echo  ██║╚██╗██║██╔══╝   ██╔██╗ ╚════██║ ██╔══╝      ██║      ██║   ██║     ██╔══╝
echo  ██║ ╚████║███████╗██╔╝ ██╗███████║ ███████╗    ██║      ██║   ███████╗███████╗
echo  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝╚══════╝ ╚══════╝    ╚═╝      ╚═╝   ╚══════╝╚══════╝
echo.
echo  AI-Powered Insurance Claims Automation Platform
echo  ════════════════════════════════════════════════
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.12+ and add it to PATH.
    pause
    exit /b 1
)

:: Navigate to backend
cd /d "%~dp0backend"

:: Create venv if not exists
if not exist "venv\" (
    echo [SETUP] Creating virtual environment...
    python -m venv venv
    echo [SETUP] Installing dependencies...
    call venv\Scripts\activate.bat
    pip install --quiet --upgrade pip
    pip install --quiet -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

:: Check .env
if not exist ".env" (
    echo [WARN] .env file not found. Copying from template...
    if exist ".env.example" (
        copy ".env.example" ".env"
        echo [WARN] Please edit backend\.env and set your GEMINI_API_KEY and email credentials.
    ) else (
        echo [WARN] Please create backend\.env with your configuration.
    )
)

:: Create media dirs
if not exist "media\claims"   mkdir media\claims
if not exist "media\reports"  mkdir media\reports

:: Bootstrap MongoDB collections and seed baseline data
echo [INFO] Bootstrapping project data...
python manage.py bootstrap_project

echo.
echo [INFO] Starting NexSettle Django Backend...
echo [INFO] Frontend + API will be available at: http://localhost:8000
echo [INFO] Press Ctrl+C to stop the server.
echo.

python manage.py runserver 0.0.0.0:8000

pause
