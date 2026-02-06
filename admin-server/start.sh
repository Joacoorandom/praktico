#!/usr/bin/env sh
# Arranque autónomo: npm install + node index.js (para Pterodactyl sin SSH)
cd "$(dirname "$0")"
echo "[Praktico Admin] npm install..."
npm install
echo "[Praktico Admin] Iniciando servidor..."
exec node index.js
