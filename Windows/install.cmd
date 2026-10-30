@echo off
rem Installs UI+ for Claude on Windows. Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ui-plus.ps1" install
pause
