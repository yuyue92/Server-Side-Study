@echo off
chcp 65001 >nul
echo.
echo   FileDrop - 局域网点对点文件传输工具
echo   =====================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装: https://nodejs.org
    pause
    exit /b 1
)

where cargo >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Rust，请先安装: https://rustup.rs
    echo 安装后重启此脚本
    pause
    exit /b 1
)

echo [OK] Rust 已安装
echo [OK] Node.js 已安装
echo.
echo [1/2] 安装 Node 依赖...
call npm install
echo.
echo [2/2] 启动开发模式（首次编译约 2-5 分钟）...
echo.
call npm run tauri dev
pause
