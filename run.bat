@echo off
set /p USERNAME="Enter your username: "
echo Your username is: %USERNAME%
set /p PASSWORD="Enter your password: "
echo Your password is: %PASSWORD%
set /p PATH_="Enter path (Careful: Please use '/' instead of '\' !): "
echo You entered this path: %PATH_%
(echo={"user":"%USERNAME%", "password":"%PASSWORD%", "path":"%PATH_%"}) > config/default.json
(echo=start cmd /k node %PATH_%/app.js) > launch.bat
SCHTASKS /create /tn horstl_exam_query /sc MINUTE /MO 30 /tr %PATH_%/launch.bat
pause