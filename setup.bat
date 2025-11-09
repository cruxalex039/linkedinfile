@echo off
title LinkedIn Automation - Quick Setup

echo =====================================================
echo LinkedIn Automation - Quick Setup Script
echo =====================================================
echo.

echo [1/4] Copying environment template...
copy .env.example .env >nul 2>&1
if exist .env (
    echo ✓ Environment file created successfully
) else (
    echo ✗ Failed to create environment file
    pause
    exit /b 1
)

echo.
echo [2/4] Installing Node.js dependencies...
npm install
if %errorlevel% equ 0 (
    echo ✓ Dependencies installed successfully
) else (
    echo ✗ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [3/4] Creating required directories...
if not exist "logs" mkdir logs
if not exist "cookies" mkdir cookies
if not exist "debug" mkdir debug
if not exist "fingerprint-profiles" mkdir fingerprint-profiles
echo ✓ Directories created successfully

echo.
echo [4/4] Setup complete!
echo.
echo =====================================================
echo IMPORTANT: Configure your .env file before starting
echo =====================================================
echo.
echo Required environment variables:
echo --------------------------------
echo TELEGRAM_BOT_TOKEN=your_telegram_bot_token
echo TELEGRAM_CHAT_ID=your_telegram_chat_id
echo TWOCAPTCHA_API_KEY=your_2captcha_api_key
echo.
echo Optional (for production):
echo --------------------------
echo NODE_ENV=production
echo ENABLE_AUTO_RECAPTCHA=true
echo.
echo To start the application:
echo -------------------------
echo npm start         (production)
echo npm run dev       (development with auto-restart)
echo.
echo To access the application:
echo --------------------------
echo http://localhost:3000
echo.
echo =====================================================

echo.
echo Would you like to open the .env file for editing? (y/n)
set /p choice=
if /i "%choice%"=="y" (
    notepad .env
)

echo.
echo Setup completed! You can now start the application.
pause