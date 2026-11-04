@echo off
cd /d "%~dp0"
echo Starting Anriri Blog Studio on http://localhost:4322 ...
start "" "http://localhost:4322"
node scripts/cms-server.js
pause
