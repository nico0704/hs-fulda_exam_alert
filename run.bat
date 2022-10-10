@echo off
set /p "USERNAME=Enter your username (fd-Nr): "
for /f "usebackq tokens=*" %%p in (`powershell -Command "$pword = read-host 'Enter password' -AsSecureString ; $BSTR=[System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pword); [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)"`) do set password=%%p
set /p "PATH_=Enter path where this file is located (Careful: Please use '/' instead of '\' !): "
set /p "WEBHOOK_URL=Enter the webhook-url if you want to send a notification to a discord server (otherwise just leave empty): "
(echo={"user":"%USERNAME%", "password":"%PASSWORD%", "webhook_url":"%WEBHOOK_URL%", "path":"%PATH_%"}) > config/default.json
(echo=start cmd /k node %PATH_%/app.js) > launch.bat
SCHTASKS /create /tn horstl_exam_query /sc MINUTE /MO 30 /tr %PATH_%/launch.bat
pause