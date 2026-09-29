@echo off
chcp 65001 > nul
title Brisoft Portaria - Inicializador Local

echo ========================================================
echo       BRISOFT PORTARIA - INICIANDO SERVIDORES LOCAIS
echo ========================================================
echo.
echo [1/2] Abrindo servidor Backend (Porta 3333)...
start "Backend - Brisoft Portaria" cmd /k "cd /d "%~dp0backend" && npm run dev"

timeout /t 2 /nobreak > nul

echo [2/2] Abrindo servidor Expo Mobile (Porta 8081)...
start "Expo Mobile - Brisoft Portaria" cmd /k "cd /d "%~dp0mobile" && npx expo start --port 8081"

echo.
echo ========================================================
echo  Tudo pronto! Duas janelas foram abertas:
echo  1. Backend API (http://localhost:3333)
echo  2. Expo Metro (exp://192.168.15.115:8081)
echo.
echo  Aguarde o QR Code aparecer na janela do Expo Mobile
echo  e aponte a camera pelo app Expo Go no celular.
echo ========================================================
echo.
pause
