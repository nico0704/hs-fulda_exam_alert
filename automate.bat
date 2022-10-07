@echo off
echo Hello!
schtasks.exe /create /tn automate-task /sc daily /st 20:00 /tr C:\Users\schro\Documents\Coding\hs-fulda_exam_alert\launch.bat
pause
