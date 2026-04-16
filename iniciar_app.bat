@echo off
chcp 65001 > nul
echo =========================================
echo          Iniciando SeminarIA
echo =========================================

:: Ir a la carpeta del backend
cd /d "%~dp0backend"

:: Comprobar si existe node_modules, si no, instalar dependencias
if not exist "node_modules\" (
    echo [INFO] Instalando dependencias del backend por primera vez...
    call npm install
)

echo [INFO] Iniciando el servidor backend...
:: Iniciar el servidor en una nueva ventana de comandos
start "SeminarIA Backend" cmd /c "npm start"

echo [INFO] Esperando a que el servidor inicie...
timeout /t 3 /nobreak > nul

echo [INFO] Abriendo la aplicacion en el navegador...
start http://localhost:3000

echo [INFO] Listo. Puedes cerrar esta ventana.
exit
