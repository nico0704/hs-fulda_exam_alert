@echo off
set /p USERNAME="Enter your username: "
echo Your username is: %USERNAME%
set /p PASSWORD="Enter your password: "
echo Your password is: %PASSWORD%
set /p PATH="Enter path (Careful: use '/' instead of '\' !): "
echo You entered this path: %PATH%
(echo={"user":"%USERNAME%", "password":"%PASSWORD%", "path":"%PATH%"}) > config/default.json
(echo=start cmd /k node %PATH%/app.js) > launch.bat
(echo=@echo off) > automate_task.bat
(echo=echo Automating Task) >> automate_task.bat
(echo=SCHTASKS /create /tn horstl_exam_query /sc MINUTE /MO 30 /tr %PATH%/launch.bat) >> automate_task.bat
(echo=pause) >> automate_task.bat
echo.
echo Almost done. Please run "automate_task.bat" to add a scheduled task to your computer.
pause