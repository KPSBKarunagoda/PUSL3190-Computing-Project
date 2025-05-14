@echo off
echo This script will clean up your hosts file. Please run as Administrator.
echo.
pause

echo Creating a backup of your current hosts file...
copy %WINDIR%\System32\drivers\etc\hosts %WINDIR%\System32\drivers\etc\hosts.bak

echo Removing phishing demo entries from hosts file...
type %WINDIR%\System32\drivers\etc\hosts | findstr /v "paypal-secure-verification.com" | findstr /v "secure-bankofamerica-verification.com" | findstr /v "microsoft-account-verify.com" > %TEMP%\hosts.new
copy %TEMP%\hosts.new %WINDIR%\System32\drivers\etc\hosts

echo.
echo Hosts file cleaned successfully.
echo.
pause
