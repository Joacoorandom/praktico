/**
 * Punto de entrada para Pterodactyl / paneles que ejecutan "node main.js".
 * Instala dependencias en admin-server y arranca el servidor de administración.
 * No requiere SSH: npm install se ejecuta solo al iniciar.
 */
const path = require("path");
const { execSync, spawn } = require("child_process");

const adminDir = path.join(__dirname, "admin-server");

console.log("[Praktico Admin] Instalando dependencias en admin-server...");
execSync("npm install", { cwd: adminDir, stdio: "inherit" });

console.log("[Praktico Admin] Iniciando servidor...");
const child = spawn(process.execPath, ["index.js"], {
  cwd: adminDir,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "production" },
});
child.on("exit", (code, signal) => {
  process.exit(code != null ? code : signal ? 1 : 0);
});
