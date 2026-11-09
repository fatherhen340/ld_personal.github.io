@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title 个人主页 · 本地预览
set PORT=8000

echo.
echo  正在启动本地预览：http://127.0.0.1:%PORT%/
echo  关闭这个窗口即可停止服务器。
echo.

start "" "http://127.0.0.1:%PORT%/"

where python >nul 2>nul
if not errorlevel 1 (
  python -m http.server %PORT% --bind 127.0.0.1
  goto :end
)

where npx >nul 2>nul
if not errorlevel 1 (
  echo  未找到 Python，改用 Node.js 的 serve。
  npx --yes serve -l %PORT% .
  goto :end
)

echo.
echo  没有找到 Python 或 Node.js。
echo  请安装 Python 3，或在项目目录执行：python -m http.server 8000
echo.
pause

:end
endlocal
