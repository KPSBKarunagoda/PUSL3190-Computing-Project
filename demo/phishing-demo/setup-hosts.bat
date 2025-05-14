@echo off
echo This script will modify your hosts file to map fake phishing domains to localhost.
echo You need to run this script as Administrator.
echo.
echo Please close this script and run as Administrator if you haven't already.
echo.
pause

echo Adding fake phishing domains to hosts file...
echo 127.0.0.1 paypal-secure-verification.com >> %WINDIR%\System32\drivers\etc\hosts
echo 127.0.0.1 secure-bankofamerica-verification.com >> %WINDIR%\System32\drivers\etc\hosts
echo 127.0.0.1 microsoft-account-verify.com >> %WINDIR%\System32\drivers\etc\hosts

echo.
echo Hosts file updated successfully.
echo.
echo You can now access your phishing demo at:
echo   http://paypal-secure-verification.com:3030
echo.
echo When done with your demonstration, run cleanup-hosts.bat to restore your hosts file.
echo.
pause
