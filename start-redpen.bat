@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "packages\web\dist\index.html" (
  echo [Redpen] 首次启动，正在构建前端页面...
  call pnpm build
)
echo [Redpen] 正在启动写作台 (http://127.0.0.1:3090)...
start "" "http://127.0.0.1:3090"
call pnpm --filter @writing/server start
