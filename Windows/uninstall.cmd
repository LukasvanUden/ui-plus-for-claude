@echo off
rem Removes UI+ for Claude from Windows. Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ui-plus.ps1" uninstall
pause
