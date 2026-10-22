@echo off
cd /d "%~dp0"
python server.py
if errorlevel 1 (
 echo.
 echo Khong khoi dong duoc PathLab. Kiem tra da cai Python va dong server cu.
 pause
)
