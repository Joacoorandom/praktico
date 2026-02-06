/**
 * Servidor de administración del catálogo Praktico.
 * Productos, categorías, marcas, destacados, galería, deploy (commit + push).
 * Protegido por login (ADMIN_USERS o ADMIN_USER/ADMIN_PASSWORD). Token GitHub se guarda en la UI.
 *
 * Carga variables desde .env si existe (dotenv). Uso:
 *   ADMIN_USERS=user:pass,user2:pass2  o  ADMIN_USER=admin ADMIN_PASSWORD=xxx
 *   DATA_PATH=../src/data PORT=25574 node index.js
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import session from "express-session";
import { simpleGit } from "simple-git";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_PATH = process.env.DATA_PATH || path.join(REPO_ROOT, "src", "data");
const PORT = Number(process.env.PORT) || 25574;

// Credenciales de login: varios usuarios (ADMIN_USERS) o uno solo (ADMIN_USER + ADMIN_PASSWORD)
// ADMIN_USERS = "usuario1:contraseña1,usuario2:contraseña2"
const ADMIN_USERS_RAW = process.env.ADMIN_USERS || "";
const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const ADMIN_CREDENTIALS = (() => {
  const map = new Map();
  if (ADMIN_USERS_RAW.trim()) {
    for (const part of ADMIN_USERS_RAW.split(",")) {
      const i = part.indexOf(":");
      if (i > 0) map.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
    }
  }
  if (ADMIN_USER && ADMIN_PASSWORD) map.set(ADMIN_USER, ADMIN_PASSWORD);
  return map;
})();

// Archivo donde se guarda el token de GitHub (solo en servidor, no en repo)
const ADMIN_DATA_DIR = process.env.ADMIN_DATA_DIR || path.join(__dirname, "data");
const GIT_TOKEN_FILE = path.join(ADMIN_DATA_DIR, "github-token.txt");

const PRODUCTS_FILE = path.join(DATA_PATH, "products.json");
const CATEGORIES_FILE = path.join(DATA_PATH, "categories.json");
const BRANDS_FILE = path.join(DATA_PATH, "brands.json");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Sesión (cookie con session ID; en Docker/Pterodactyl suele ir por el mismo dominio)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "praktico-admin-secret-cambiar-en-produccion",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.SESSION_SECURE === "true",
    },
    name: "praktico.sid",
  })
);

function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  if (req.path === "/login" || req.path === "/api/auth/login" || req.path === "/api/health") return next();
  if (req.path.startsWith("/api/") && !req.path.startsWith("/api/auth/")) {
    return res.status(401).json({ error: "No autorizado. Iniciá sesión." });
  }
  return res.redirect("/login");
}

app.use(requireAuth);

// ---------- Login (público: /login y /api/auth/login) ----------
const LOGIN_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Iniciar sesión · Praktico Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
  <style>
    :root { --bg: #f5f3ef; --surface: #fff; --text: #1a1a1a; --muted: #5a5a5a; --accent: #1a1a1a; --border: rgba(0,0,0,.1); --radius: 12px; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'DM Sans', system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 32px; width: 100%; max-width: 360px; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
    h1 { margin: 0 0 8px; font-size: 1.35rem; }
    p { margin: 0 0 20px; color: var(--muted); font-size: 0.9rem; }
    label { display: block; margin-bottom: 6px; font-weight: 600; font-size: 14px; }
    input { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 16px; font-family: inherit; margin-bottom: 16px; }
    .btn { width: 100%; padding: 12px; background: var(--accent); color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 16px; cursor: pointer; font-family: inherit; }
    .btn:hover { filter: brightness(1.05); }
    .error { background: #ffebee; color: #b71c1c; padding: 10px; border-radius: 8px; font-size: 14px; margin-bottom: 16px; display: none; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Praktico Admin</h1>
    <p>Iniciá sesión para administrar el catálogo y aplicar cambios.</p>
    <div id="login-error" class="error"></div>
    <form id="login-form" method="post" action="/api/auth/login">
      <label for="user">Usuario</label>
      <input type="text" id="user" name="user" required autocomplete="username"/>
      <label for="password">Contraseña</label>
      <input type="password" id="password" name="password" required autocomplete="current-password"/>
      <button type="submit" class="btn">Entrar</button>
    </form>
  </div>
  <script>
    document.getElementById('login-form').onsubmit = function(e) {
      e.preventDefault();
      const err = document.getElementById('login-error');
      err.style.display = 'none';
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: document.getElementById('user').value,
          password: document.getElementById('password').value
        })
      }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function({ ok, data }) {
          if (ok && data.ok) { window.location.href = '/'; return; }
          err.textContent = data.error || 'Usuario o contraseña incorrectos';
          err.style.display = 'block';
        }).catch(function() { err.textContent = 'Error de conexión'; err.style.display = 'block'; });
    };
  </script>
</body>
</html>`;

app.get("/login", (req, res) => {
  if (req.session?.user) return res.redirect("/");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(LOGIN_HTML);
});

app.post("/api/auth/login", (req, res) => {
  const user = String(req.body?.user || "").trim();
  const password = String(req.body?.password || "");
  if (ADMIN_CREDENTIALS.size === 0) {
    return res.status(500).json({ ok: false, error: "El servidor no tiene configurado ADMIN_USERS o ADMIN_USER/ADMIN_PASSWORD." });
  }
  if (ADMIN_CREDENTIALS.get(user) === password) {
    req.session.user = user;
    req.session.save((err) => {
      if (err) return res.status(500).json({ ok: false, error: "Error al guardar sesión." });
      res.json({ ok: true, user });
    });
  } else {
    res.status(401).json({ ok: false, error: "Usuario o contraseña incorrectos." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", (req, res) => {
  if (req.session?.user) return res.json({ ok: true, user: req.session.user });
  res.status(401).json({ ok: false });
});

// ---------- Configuración Git (token GitHub, solo si hay login) ----------
function readGitToken() {
  try {
    if (fs.existsSync(GIT_TOKEN_FILE)) return fs.readFileSync(GIT_TOKEN_FILE, "utf8").trim();
  } catch (_) {}
  return null;
}

function writeGitToken(token) {
  fs.mkdirSync(ADMIN_DATA_DIR, { recursive: true });
  fs.writeFileSync(GIT_TOKEN_FILE, String(token).trim(), "utf8");
}

app.get("/api/settings/git", (req, res) => {
  res.json({ hasToken: !!readGitToken() });
});

app.post("/api/settings/git", (req, res) => {
  const token = req.body?.token != null ? String(req.body.token).trim() : "";
  if (!token) return res.status(400).json({ error: "Token es obligatorio." });
  try {
    writeGitToken(token);
    res.json({ ok: true, message: "Token guardado." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------- Productos ----------
app.get("/api/products", (req, res) => {
  try {
    const data = readJson(PRODUCTS_FILE);
    res.json(Array.isArray(data) ? data : []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/products/:slug", (req, res) => {
  try {
    const data = readJson(PRODUCTS_FILE);
    const arr = Array.isArray(data) ? data : [];
    const p = arr.find((x) => x.slug === req.params.slug);
    if (!p) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(p);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/products", (req, res) => {
  try {
    const products = readJson(PRODUCTS_FILE);
    if (!Array.isArray(products)) throw new Error("products.json debe ser un array");
    const body = req.body;
    const slug = slugify(body.slug || body.name) || slugify(body.name);
    if (products.some((p) => p.slug === slug)) throw new Error(`Ya existe producto con slug "${slug}"`);
    const id = `p-${Math.max(0, ...products.map((p) => parseInt(String(p.id).replace(/\D/g, ""), 10) || 0)) + 1}`;
    const newProduct = {
      id,
      slug,
      name: String(body.name || "").trim() || "Sin nombre",
      price: Number(body.price) || 0,
      image: String(body.image || "").trim() || "/products/placeholder.svg",
      description: String(body.description || "").trim() || "",
      ...(body.brand ? { brand: body.brand } : {}),
      ...(body.categories?.length ? { categories: body.categories } : {}),
      ...(body.gallery?.length ? { gallery: body.gallery } : {}),
      ...(body.featured === true ? { featured: true } : {}),
      ...(body.shipping ? { shipping: body.shipping } : {}),
    };
    products.push(newProduct);
    writeJson(PRODUCTS_FILE, products);
    res.status(201).json(newProduct);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/api/products/:slug", (req, res) => {
  try {
    const products = readJson(PRODUCTS_FILE);
    if (!Array.isArray(products)) throw new Error("products.json debe ser un array");
    const i = products.findIndex((p) => p.slug === req.params.slug);
    if (i < 0) return res.status(404).json({ error: "Producto no encontrado" });
    const body = req.body;
    if (body.featured !== undefined) products[i].featured = !!body.featured;
    if (body.name !== undefined) products[i].name = String(body.name).trim();
    if (body.price !== undefined) products[i].price = Number(body.price);
    if (body.description !== undefined) products[i].description = String(body.description);
    if (body.image !== undefined) products[i].image = String(body.image).trim();
    if (body.gallery !== undefined) products[i].gallery = Array.isArray(body.gallery) ? body.gallery : [];
    if (body.categories !== undefined) products[i].categories = Array.isArray(body.categories) ? body.categories : [];
    if (body.shipping !== undefined) products[i].shipping = body.shipping;
    writeJson(PRODUCTS_FILE, products);
    res.json(products[i]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/products/:slug", (req, res) => {
  try {
    const products = readJson(PRODUCTS_FILE);
    if (!Array.isArray(products)) throw new Error("products.json debe ser un array");
    const next = products.filter((p) => p.slug !== req.params.slug);
    if (next.length === products.length) return res.status(404).json({ error: "Producto no encontrado" });
    writeJson(PRODUCTS_FILE, next);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Categorías ----------
app.get("/api/categories", (req, res) => {
  try {
    const data = fs.existsSync(CATEGORIES_FILE) ? readJson(CATEGORIES_FILE) : [];
    res.json(Array.isArray(data) ? data : []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/categories", (req, res) => {
  try {
    const categories = fs.existsSync(CATEGORIES_FILE) ? readJson(CATEGORIES_FILE) : [];
    if (!Array.isArray(categories)) throw new Error("categories.json debe ser un array");
    const name = String(req.body.name || "").trim();
    if (!name) throw new Error("name es obligatorio");
    const slug = slugify(req.body.slug || name);
    if (categories.some((c) => c.slug === slug)) throw new Error(`Ya existe categoría "${slug}"`);
    const id = `c-${categories.length + 1}`;
    categories.push({ id, slug, name });
    writeJson(CATEGORIES_FILE, categories);
    res.status(201).json({ id, slug, name });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/categories/:slug", (req, res) => {
  try {
    const categories = readJson(CATEGORIES_FILE);
    const next = categories.filter((c) => c.slug !== req.params.slug);
    if (next.length === categories.length) return res.status(404).json({ error: "Categoría no encontrada" });
    writeJson(CATEGORIES_FILE, next);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Marcas ----------
app.get("/api/brands", (req, res) => {
  try {
    const data = fs.existsSync(BRANDS_FILE) ? readJson(BRANDS_FILE) : [];
    res.json(Array.isArray(data) ? data : []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/brands", (req, res) => {
  try {
    const brands = fs.existsSync(BRANDS_FILE) ? readJson(BRANDS_FILE) : [];
    if (!Array.isArray(brands)) throw new Error("brands.json debe ser un array");
    const name = String(req.body.name || "").trim();
    if (!name) throw new Error("name es obligatorio");
    const slug = slugify(req.body.slug || name);
    if (brands.some((b) => b.slug === slug)) throw new Error(`Ya existe marca "${slug}"`);
    const id = `b-${brands.length + 1}`;
    brands.push({ id, slug, name });
    writeJson(BRANDS_FILE, brands);
    res.status(201).json({ id, slug, name });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------- Destacados: atajo ----------
app.get("/api/featured", (req, res) => {
  try {
    const products = readJson(PRODUCTS_FILE);
    const featured = (Array.isArray(products) ? products : []).filter((p) => p.featured);
    res.json(featured);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/products/:slug/featured", (req, res) => {
  try {
    const products = readJson(PRODUCTS_FILE);
    const i = products.findIndex((p) => p.slug === req.params.slug);
    if (i < 0) return res.status(404).json({ error: "Producto no encontrado" });
    products[i].featured = req.body.featured !== false;
    writeJson(PRODUCTS_FILE, products);
    res.json(products[i]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Aplicar cambios (commit + push) ----------
app.post("/api/apply", async (req, res) => {
  try {
    const git = simpleGit(REPO_ROOT);
    await git.add("src/data/");
    const status = await git.status();
    const staged = status.staged?.length ?? 0;

    if (staged === 0) {
      return res.json({
        ok: true,
        message: "No hay cambios pendientes en src/data/.",
        changes: 0,
        pushed: false,
      });
    }

    const userName = process.env.GIT_USER_NAME || "Praktico Admin";
    const userEmail = process.env.GIT_USER_EMAIL || "admin@praktico.shop";
    await git.addConfig("user.name", userName).catch(() => {});
    await git.addConfig("user.email", userEmail).catch(() => {});

    const message = req.body?.message || `Admin: actualizar catálogo (+${staged} archivo(s))`;
    await git.commit(message);

    let pushed = false;
    let pushError = null;
    const token = readGitToken();
    let originalOriginUrl = null;

    try {
      if (token) {
        const remotes = await git.getRemotes(true);
        const origin = remotes.origin;
        const url = (origin && (origin.push || origin.fetch)) ? (origin.push || origin.fetch) : null;
        if (url && (url.startsWith("https://github.com/") || url.startsWith("http://github.com/"))) {
          originalOriginUrl = url;
          const withToken = url.replace(/^https?:\/\//, `https://${token}@`);
          await git.raw(["remote", "set-url", "origin", withToken]);
        }
      }
      await git.push();
      pushed = true;
    } catch (e) {
      pushError = e.message || String(e);
    } finally {
      if (originalOriginUrl) {
        try {
          await git.raw(["remote", "set-url", "origin", originalOriginUrl]);
        } catch (_) {}
      }
    }

    res.json({
      ok: true,
      message: pushed ? `+${staged} cambio(s) aplicados y subidos.` : `Commit hecho; push falló: ${pushError}`,
      changes: staged,
      pushed,
      pushError: pushed ? null : pushError,
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message || String(e),
      changes: 0,
      pushed: false,
    });
  }
});

app.get("/api/apply/status", async (req, res) => {
  try {
    const git = simpleGit(REPO_ROOT);
    const status = await git.status();
    const files = status.files || [];
    const dataFiles = files.filter((f) => f.path.startsWith("src/data/"));
    res.json({
      ok: true,
      changes: dataFiles.length,
      files: dataFiles.map((f) => f.path),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------- UI Admin (tema Praktico) ----------
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Admin · Praktico</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
  <style>
    :root {
      --bg: #f5f3ef;
      --surface: #fff;
      --surface2: #f0ebe3;
      --text: #1a1a1a;
      --muted: #5a5a5a;
      --accent: #1a1a1a;
      --border: rgba(0,0,0,.1);
      --radius: 12px;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'DM Sans', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; }
    .container { max-width: 900px; margin: 0 auto; padding: 24px 20px; }
    .header { border-bottom: 3px solid var(--accent); padding: 20px 0; margin-bottom: 32px; }
    .header h1 { margin: 0; font-size: 1.5rem; font-weight: 800; }
    .header p { margin: 6px 0 0; color: var(--muted); font-size: 0.9rem; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
    .card h2 { margin: 0 0 12px; font-size: 1.1rem; font-weight: 700; }
    .btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer; border: none; font-family: inherit; transition: transform .15s, box-shadow .2s; }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:hover { filter: brightness(1.05); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.2); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .status { margin-top: 12px; padding: 12px; border-radius: 8px; font-size: 0.9rem; }
    .status.success { background: #e8f5e9; color: #1b5e20; }
    .status.error { background: #ffebee; color: #b71c1c; }
    .status.pending { background: var(--surface2); color: var(--muted); }
    .muted { color: var(--muted); font-size: 0.9rem; }
    ul { margin: 0; padding-left: 20px; }
    #product-list { list-style: none; padding-left: 0; }
    #product-list li { padding: 8px 0; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    #product-list li:last-child { border-bottom: none; }
    .badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; background: var(--accent); color: #fff; }
    .row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    input[type="password"], input[type="text"] { width: 100%; max-width: 400px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font-family: inherit; }
    .btn-secondary { background: var(--surface2); color: var(--text); }
    .btn-secondary:hover { filter: brightness(0.96); }
    a { color: var(--accent); }
  </style>
</head>
<body>
  <div class="container">
    <header class="header row">
      <div>
        <h1>Praktico Admin</h1>
        <p>Catálogo y aplicar cambios al repo (commit + push).</p>
      </div>
      <div>
        <span class="muted" id="auth-user"></span>
        <button type="button" class="btn btn-secondary" id="btn-logout" style="margin-left:8px">Cerrar sesión</button>
      </div>
    </header>

    <div class="card">
      <h2>Configurar GitHub</h2>
      <p class="muted">Token de acceso personal (PAT) para hacer commit y push desde este servidor. Se guarda solo aquí y se usa solo al aplicar cambios.</p>
      <p id="git-has-token" class="muted" style="display:none">✓ Token guardado. Podés reemplazarlo abajo.</p>
      <input type="password" id="git-token" placeholder="ghp_xxxxxxxxxxxx" autocomplete="off"/>
      <button type="button" class="btn btn-primary" id="btn-save-token" style="margin-top:8px">Guardar token</button>
      <div id="token-status" class="status" style="display:none; margin-top:8px"></div>
    </div>

    <div class="card">
      <h2>Resumen</h2>
      <p class="muted">Productos: <strong id="product-count">—</strong> · Destacados: <strong id="featured-count">—</strong></p>
      <p class="muted" style="margin-top:8px">Cuando termines de configurar la tienda, aplicá los cambios para subir al repo y disparar el deploy en Vercel.</p>
    </div>

    <div class="card">
      <h2>Aplicar cambios</h2>
      <p class="muted">Hace commit de <code>src/data/*.json</code> y push al remoto. El servidor debe tener credenciales Git configuradas.</p>
      <button type="button" class="btn btn-primary" id="btn-apply">Aplicar cambios</button>
      <div id="apply-status" class="status" style="display:none"></div>
    </div>

    <div class="card">
      <h2>Productos</h2>
      <ul id="product-list"></ul>
    </div>
  </div>
  <script>
    const API = '';
    async function loadAuth() {
      const me = await fetch(API + '/api/auth/me').then(r => r.ok ? r.json() : null).catch(() => null);
      if (me && me.user) {
        document.getElementById('auth-user').textContent = me.user;
        document.getElementById('btn-logout').style.display = 'inline-flex';
      }
      const git = await fetch(API + '/api/settings/git').then(r => r.json()).catch(() => ({ hasToken: false }));
      if (git.hasToken) document.getElementById('git-has-token').style.display = 'block';
    }
    document.getElementById('btn-logout').onclick = function() {
      fetch(API + '/api/auth/logout', { method: 'POST' }).then(function() { window.location.href = '/login'; });
    };
    document.getElementById('btn-save-token').onclick = async function() {
      const token = document.getElementById('git-token').value.trim();
      const statusEl = document.getElementById('token-status');
      statusEl.style.display = 'block';
      if (!token) { statusEl.className = 'status error'; statusEl.textContent = 'Escribí el token.'; return; }
      try {
        const r = await fetch(API + '/api/settings/git', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
        const d = await r.json();
        statusEl.className = 'status ' + (d.error ? 'error' : 'success');
        statusEl.textContent = d.error || d.message || 'Guardado.';
        if (!d.error) { document.getElementById('git-token').value = ''; document.getElementById('git-has-token').style.display = 'block'; }
      } catch (e) { statusEl.className = 'status error'; statusEl.textContent = e.message || 'Error'; }
    };
    async function load() {
      await loadAuth();
      try {
        const [products, status] = await Promise.all([
          fetch(API + '/api/products').then(r => r.json()),
          fetch(API + '/api/apply/status').then(r => r.json()).catch(() => ({ changes: 0 }))
        ]);
        document.getElementById('product-count').textContent = products.length;
        document.getElementById('featured-count').textContent = products.filter(p => p.featured).length;
        const ul = document.getElementById('product-list');
        ul.innerHTML = products.slice(0, 20).map(p => '<li><span>' + p.name + '</span>' + (p.featured ? ' <span class="badge">Destacado</span>' : '') + '</li>').join('');
        if (products.length > 20) ul.innerHTML += '<li class="muted">… y ' + (products.length - 20) + ' más</li>';
      } catch (e) {
        document.getElementById('product-count').textContent = 'Error';
      }
    }
    document.getElementById('btn-apply').onclick = async function() {
      const btn = this;
      const statusEl = document.getElementById('apply-status');
      statusEl.style.display = 'block';
      statusEl.className = 'status pending';
      statusEl.textContent = 'Aplicando…';
      btn.disabled = true;
      try {
        const res = await fetch(API + '/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        const data = await res.json();
        statusEl.className = 'status ' + (data.ok ? 'success' : 'error');
        statusEl.textContent = data.ok ? ('+ ' + (data.changes || 0) + ' cambio(s) aplicados.' + (data.pushed ? ' Subido al remoto.' : (data.pushError ? ' Push: ' + data.pushError : ''))) : (data.error || 'Error');
      } catch (e) {
        statusEl.className = 'status error';
        statusEl.textContent = e.message || 'Error de red';
      }
      btn.disabled = false;
      load();
    };
    load();
  </script>
</body>
</html>
`;

app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(ADMIN_HTML);
});

// ---------- Health ----------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, dataPath: DATA_PATH, repoRoot: REPO_ROOT });
});

app.listen(PORT, () => {
  console.log(`Praktico Admin API: http://localhost:${PORT}`);
  console.log(`Data path: ${DATA_PATH}`);
  console.log(`Repo root (git): ${REPO_ROOT}`);
});
