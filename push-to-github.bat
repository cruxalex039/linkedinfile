@echo off
echo LinkedIn Automation - GitHub Push Script
echo ==========================================
echo.
echo This script will help you push your LinkedIn automation project to GitHub.
echo.
echo Prerequisites:
echo 1. Ensure you have internet connectivity
echo 2. Make sure Git is installed and configured
echo 3. Have your GitHub credentials ready
echo.
pause
echo.
echo Setting up Git configuration...
git config --global user.name "cruxalex039"
git config --global user.email "cruxalex039@gmail.com"
echo.
echo Adding files to Git...
git add .
echo.
echo Committing changes...
git commit -m "LinkedIn automation system - production ready"
echo.
echo Adding GitHub remote...
git remote remove origin 2>nul
git remote add origin https://github.com/cruxalex039/linkedinfile.git
echo.
echo Pushing to GitHub...
echo Note: You will be prompted for your GitHub credentials
echo Username: cruxalex039@gmail.com
echo Password: 12oclock@Policy
echo.
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo SUCCESS! Project has been pushed to GitHub successfully!
    echo Repository URL: https://github.com/cruxalex039/linkedinfile.git
) else (
    echo FAILED! There was an error pushing to GitHub.
    echo Please check your internet connection and try again.
)
echo.
pause