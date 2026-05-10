@echo off
REM ============================================================
REM  Descarga diaria de pedidos Venndelo → Google Drive
REM  Este archivo lo ejecuta el Programador de Tareas de Windows
REM ============================================================

cd /d "D:\Users\Dell\Desktop\Claude\venndelo-backend"

echo [%DATE% %TIME%] Iniciando descarga de pedidos >> scripts\logs\descarga.log
node scripts\descargar-pedidos.js >> scripts\logs\descarga.log 2>&1
echo [%DATE% %TIME%] Proceso finalizado con codigo %ERRORLEVEL% >> scripts\logs\descarga.log
