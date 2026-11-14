@echo off
pushd "%~dp0"
call npm ci --no-audit --no-fund --cache "%USERPROFILE%\agent-files\trash\npm-cache"
set "previewSetupCode=%ERRORLEVEL%"
popd
if not "%previewSetupCode%"=="0" pause
exit /b %previewSetupCode%
