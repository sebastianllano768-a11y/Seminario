#!/bin/bash
echo "========================================="
echo "       Iniciando SeminarIA               "
echo "========================================="

# Ir al directorio del backend
cd "$(dirname "$0")/backend" || exit 1

# Comprobar si existe node_modules, si no, instalar
if [ ! -d "node_modules" ]; then
    echo "[INFO] Instalando dependencias del backend por primera vez..."
    npm install
fi

echo "[INFO] Iniciando el servidor backend en segundo plano..."
npm start &
BACKEND_PID=$!

echo "[INFO] Esperando a que el servidor inicie..."
sleep 3

echo "[INFO] Abriendo la aplicación en el navegador..."
# Abrir la URL dependiendo del sistema operativo (incluye soporte Windows en caso de Git Bash)
if command -v start >/dev/null 2>&1; then
    start http://localhost:3000
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:3000
elif command -v open >/dev/null 2>&1; then
    open http://localhost:3000
else
    echo "[INFO] Por favor, abre manualmente http://localhost:3000 en tu navegador."
fi

# Mantener el script activo para que el servidor siga corriendo
echo "[INFO] Servidor corriendo (PID $BACKEND_PID). Presiona Ctrl+C para detener."
wait $BACKEND_PID
