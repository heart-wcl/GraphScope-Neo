@echo off
REM Initialize Visual Studio build environment and run Tauri build
REM This script ensures MSVC linker and Windows SDK are properly configured

call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1

cd /d "%~dp0\.."

if "%1"=="dev" (
    echo Starting Tauri dev mode...
    pnpm tauri dev
) else (
    echo Building Tauri release...
    pnpm tauri build
)
