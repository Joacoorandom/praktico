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
const DEFAULT_REPO_DATA = path.join(REPO_ROOT, "src", "data");
const DEFAULT_LOCAL_DATA = path.join(__dirname, "data");
const DATA_PATH = process.env.DATA_PATH || (fs.existsSync(DEFAULT_REPO_DATA) ? DEFAULT_REPO_DATA : DEFAULT_LOCAL_DATA);
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
const GIT_REPO_URL = process.env.GIT_REPO_URL || "https://github.com/Joacoorandom/praktico.git";
const REPO_CLONE_DIR = path.join(ADMIN_DATA_DIR, "repo");
const REPO_DATA_DIR = path.join(REPO_CLONE_DIR, "src", "data");

const PRODUCTS_FILE = path.join(DATA_PATH, "products.json");
const CATEGORIES_FILE = path.join(DATA_PATH, "categories.json");
const BRANDS_FILE = path.join(DATA_PATH, "brands.json");
const CATALOG_META_FILE = path.join(DATA_PATH, "catalog-meta.json");
const CATALOG_FILES = ["products.json", "categories.json", "brands.json", "catalog-meta.json"];

function ensureDataDir() {
  fs.mkdirSync(DATA_PATH, { recursive: true });
  [PRODUCTS_FILE, CATEGORIES_FILE, BRANDS_FILE].forEach((file) => {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, "[]\n", "utf8");
    }
  });
}
ensureDataDir();

const app = express();
app.set("trust proxy", 1); // para que X-Forwarded-Proto funcione detrás de Nginx
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
    <p>Iniciá sesión para administrar el catálogo y aplicar cambios. PROOF: opal-dolphin-9471</p>
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

function markCatalogEdited() {
  let meta = {};
  try {
    if (fs.existsSync(CATALOG_META_FILE)) meta = readJson(CATALOG_META_FILE);
  } catch {
    meta = {};
  }
  meta.updatedAt = new Date().toISOString();
  if (!meta.message) meta.message = "Catálogo actualizado";
  writeJson(CATALOG_META_FILE, meta);
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
      ...(body.soldOut === true ? { soldOut: true } : {}),
      ...(body.virtual === true ? { virtual: true } : {}),
      ...(body.shipping ? { shipping: body.shipping } : {}),
    };
    products.push(newProduct);
    writeJson(PRODUCTS_FILE, products);
    markCatalogEdited();
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
    if (body.soldOut !== undefined) products[i].soldOut = !!body.soldOut;
    if (body.virtual !== undefined) products[i].virtual = !!body.virtual;
    if (body.name !== undefined) products[i].name = String(body.name).trim();
    if (body.price !== undefined) products[i].price = Number(body.price);
    if (body.description !== undefined) products[i].description = String(body.description);
    if (body.image !== undefined) products[i].image = String(body.image).trim();
    if (body.gallery !== undefined) products[i].gallery = Array.isArray(body.gallery) ? body.gallery : [];
    if (body.categories !== undefined) products[i].categories = Array.isArray(body.categories) ? body.categories : [];
    if (body.brand !== undefined) {
      const b = body.brand ? String(body.brand).trim() : "";
      if (b) products[i].brand = b; else delete products[i].brand;
    }
    if (body.shipping !== undefined) products[i].shipping = body.shipping;
    writeJson(PRODUCTS_FILE, products);
    markCatalogEdited();
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
    markCatalogEdited();
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
    markCatalogEdited();
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
    markCatalogEdited();
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
    markCatalogEdited();
    res.status(201).json({ id, slug, name });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/brands/:slug", (req, res) => {
  try {
    const brands = readJson(BRANDS_FILE);
    const next = brands.filter((b) => b.slug !== req.params.slug);
    if (next.length === brands.length) return res.status(404).json({ error: "Marca no encontrada" });
    writeJson(BRANDS_FILE, next);
    markCatalogEdited();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    markCatalogEdited();
    res.json(products[i]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Aplicar cambios (commit + push) ----------
function getDataPathForGit() {
  const rel = path.relative(REPO_ROOT, DATA_PATH);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) return rel.replace(/\\/g, "/") + "/";
  return "src/data/";
}

function urlWithToken(url, token) {
  if (!token) return url;
  return url.replace(/^https?:\/\//, `https://${token}@`);
}

function readJsonSafe(filePath, fallback = null) {
  try {
    return readJson(filePath);
  } catch {
    return fallback;
  }
}

function normalizeJsonContent(content) {
  try {
    return JSON.stringify(JSON.parse(content));
  } catch {
    return String(content || "").trim();
  }
}

function readFileNormalized(filePath) {
  if (!fs.existsSync(filePath)) return "";
  return normalizeJsonContent(fs.readFileSync(filePath, "utf8"));
}

function copyCatalogFiles(fromDir, toDir) {
  fs.mkdirSync(toDir, { recursive: true });
  for (const f of CATALOG_FILES) {
    const src = path.join(fromDir, f);
    const dest = path.join(toDir, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, dest);
  }
}

function catalogMetaTime(meta) {
  const t = Date.parse(meta?.updatedAt || 0);
  return Number.isFinite(t) ? t : 0;
}

function localHasPendingChanges(repoDir, localDir) {
  for (const f of CATALOG_FILES) {
    if (readFileNormalized(path.join(localDir, f)) !== readFileNormalized(path.join(repoDir, f))) {
      return true;
    }
  }
  return false;
}

function isRepoCatalogNewer(repoDir, localDir) {
  const repoMeta = readJsonSafe(path.join(repoDir, "catalog-meta.json"), {});
  const localMeta = readJsonSafe(path.join(localDir, "catalog-meta.json"), {});
  const repoAt = catalogMetaTime(repoMeta);
  const localAt = catalogMetaTime(localMeta);
  if (repoAt > localAt) return true;
  if (localAt > repoAt) return false;
  return localHasPendingChanges(repoDir, localDir);
}

async function ensureRepoClone() {
  const token = readGitToken();
  if (!token) {
    throw new Error("Configurá el token de GitHub (Git / Token) para usar el repo.");
  }
  const cloneUrl = urlWithToken(GIT_REPO_URL, token);
  fs.mkdirSync(ADMIN_DATA_DIR, { recursive: true });

  const hasClone = fs.existsSync(path.join(REPO_CLONE_DIR, ".git"));
  if (!hasClone) {
    if (fs.existsSync(REPO_CLONE_DIR)) {
      fs.rmSync(REPO_CLONE_DIR, { recursive: true });
    }
    await simpleGit().clone(cloneUrl, REPO_CLONE_DIR, ["--depth", "1"]);
  } else {
    const git = simpleGit(REPO_CLONE_DIR);
    await git.remote(["set-url", "origin", cloneUrl]);
    await git.pull();
  }

  return simpleGit(REPO_CLONE_DIR);
}

/** Trae el catálogo del repo (pull) y copia repo/src/data/*.json → DATA_PATH. */
async function pullCatalogFromRepo() {
  await ensureRepoClone();
  copyCatalogFiles(REPO_DATA_DIR, DATA_PATH);
  return { ok: true, message: "Catálogo actualizado desde el repo." };
}

async function syncToGitHubViaClone() {
  const git = await ensureRepoClone();

  if (isRepoCatalogNewer(REPO_DATA_DIR, DATA_PATH)) {
    copyCatalogFiles(REPO_DATA_DIR, DATA_PATH);
    return {
      staged: 0,
      pushed: false,
      syncedFromRepo: true,
      message: "GitHub tenía cambios más recientes. Panel actualizado; no se subió data vieja.",
    };
  }

  if (!localHasPendingChanges(REPO_DATA_DIR, DATA_PATH)) {
    return { staged: 0, pushed: false, message: "No hay cambios respecto al repo." };
  }

  copyCatalogFiles(DATA_PATH, REPO_DATA_DIR);

  const userName = process.env.GIT_USER_NAME || "Praktico Admin";
  const userEmail = process.env.GIT_USER_EMAIL || "admin@praktico.shop";
  await git.addConfig("user.name", userName).catch(() => {});
  await git.addConfig("user.email", userEmail).catch(() => {});

  await git.add("src/data/");
  const status = await git.status();
  const staged = status.staged?.length ?? 0;

  if (staged === 0) {
    return { staged: 0, pushed: false, message: "No hay cambios respecto al repo." };
  }

  const message = `Admin: actualizar catálogo (+${staged} archivo(s))`;
  await git.commit(message);
  await git.push();

  return { staged, pushed: true, message: `+${staged} cambio(s) aplicados y subidos.` };
}

app.post("/api/apply", async (req, res) => {
  try {
    const hasLocalRepo = fs.existsSync(path.join(REPO_ROOT, ".git"));

    if (hasLocalRepo) {
      const git = simpleGit(REPO_ROOT);
      const dataRel = getDataPathForGit();
      await git.add(dataRel);
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
            await git.raw(["remote", "set-url", "origin", urlWithToken(url, token)]);
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

      return res.json({
        ok: true,
        message: pushed ? `+${staged} cambio(s) aplicados y subidos.` : `Commit hecho; push falló: ${pushError}`,
        changes: staged,
        pushed,
        pushError: pushed ? null : pushError,
      });
    }

    const result = await syncToGitHubViaClone();
    res.json({
      ok: true,
      message: result.message,
      changes: result.staged,
      pushed: result.pushed,
      syncedFromRepo: !!result.syncedFromRepo,
      pushError: null,
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

app.post("/api/sync", async (req, res) => {
  try {
    if (fs.existsSync(path.join(REPO_ROOT, ".git"))) {
      const git = simpleGit(REPO_ROOT);
      const token = readGitToken();
      if (token) {
        const remotes = await git.getRemotes(true);
        const url = remotes.origin?.push || remotes.origin?.fetch;
        if (url) {
          await git.raw(["remote", "set-url", "origin", urlWithToken(url, token)]);
          await git.pull();
          await git.raw(["remote", "set-url", "origin", url]).catch(() => {});
        }
      }
      return res.json({ ok: true, message: "Repo actualizado (pull)." });
    }
    const result = await pullCatalogFromRepo();
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

app.get("/api/apply/status", async (req, res) => {
  try {
    if (!fs.existsSync(path.join(REPO_ROOT, ".git"))) {
      const token = readGitToken();
      return res.json({
        ok: true,
        changes: 0,
        files: [],
        noGit: true,
        canSyncToGitHub: !!token,
        message: token ? "Podés usar Aplicar cambios para subir al repo con el PAT guardado." : "Configurá el token (Git / Token) para subir al repo.",
      });
    }
    const git = simpleGit(REPO_ROOT);
    const status = await git.status();
    const files = status.files || [];
    const prefix = getDataPathForGit().replace(/\/$/, "");
    const dataFiles = files.filter((f) => f.path === prefix || f.path.startsWith(prefix + "/"));
    res.json({
      ok: true,
      changes: dataFiles.length,
      files: dataFiles.map((f) => f.path),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------- UI Admin (tema Praktico: grid tipo catálogo, filtro categoría) ----------
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
    :root { --bg: #f5f3ef; --surface: #fff; --surface2: #f0ebe3; --text: #1a1a1a; --muted: #5a5a5a; --accent: #1a1a1a; --border: rgba(0,0,0,.1); --radius: 12px; --shadow: 0 4px 20px rgba(0,0,0,.08); }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'DM Sans', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; }
    .container { width: min(1120px, calc(100% - 40px)); margin: 0 auto; padding: 0 20px; }
    .header { border-bottom: 3px solid var(--accent); padding: 16px 0; margin-bottom: 20px; }
    .header-inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
    .header h1 { margin: 0; font-size: 1.4rem; font-weight: 800; }
    .header p { margin: 4px 0 0; color: var(--muted); font-size: 0.85rem; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 20px; }
    .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; border: none; font-family: inherit; transition: transform .15s, box-shadow .2s; }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:hover { filter: brightness(1.05); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.2); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .btn-secondary { background: var(--surface2); color: var(--text); }
    .btn-secondary:hover { filter: brightness(0.96); }
    .btn-small { padding: 6px 12px; font-size: 12px; }
    .btn-danger { background: #b71c1c; color: #fff; }
    .btn-danger:hover { filter: brightness(1.1); }
    .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 24px; }
    .product-card { background: var(--surface); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow); border: 1px solid var(--border); transition: transform .2s, box-shadow .2s; }
    .product-card:hover { transform: translateY(-4px); box-shadow: 0 8px 28px rgba(0,0,0,.12); }
    .product-card .img-wrap { display: block; aspect-ratio: 4/3; background: var(--surface2); overflow: hidden; }
    .product-card .img-wrap img { width: 100%; height: 100%; object-fit: cover; }
    .product-card .card-body { padding: 16px; }
    .product-card .card-title { margin: 0 0 6px; font-size: 1rem; font-weight: 700; line-height: 1.3; }
    .product-card .price { font-weight: 700; font-size: 1.05rem; margin-bottom: 4px; }
    .product-card .meta { color: var(--muted); font-size: 0.8rem; margin-bottom: 8px; }
    .product-card .btn-row { display: flex; gap: 8px; margin-top: 12px; }
    .badge { font-size: 0.7rem; padding: 2px 6px; border-radius: 999px; background: var(--accent); color: #fff; margin-left: 6px; }
    .filter-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
    .filter-row label { font-weight: 600; font-size: 13px; }
    .filter-row select { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border); font-family: inherit; min-width: 180px; }
    .status { margin-top: 12px; padding: 12px; border-radius: 8px; font-size: 0.9rem; }
    .status.success { background: #e8f5e9; color: #1b5e20; }
    .status.error { background: #ffebee; color: #b71c1c; }
    .status.pending { background: var(--surface2); color: var(--muted); }
    .muted { color: var(--muted); font-size: 0.9rem; }
    input, textarea, select { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font-family: inherit; margin-bottom: 10px; }
    textarea { min-height: 80px; resize: vertical; }
    label { display: block; font-weight: 600; font-size: 13px; margin-bottom: 4px; }
    .form-row { margin-bottom: 12px; }
    .form-row.checkboxes { display: flex; flex-wrap: wrap; gap: 12px 20px; }
    .form-row.checkboxes label { display: flex; align-items: center; gap: 6px; font-weight: 500; }
    .form-row.flex { display: flex; align-items: center; gap: 10px; }
    .form-row.flex label { margin-bottom: 0; }
    .form-row.flex input[type="checkbox"] { width: auto; margin: 0; }
    .info-icon { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; margin-left: 6px; font-size: 11px; font-weight: 700; color: var(--muted); background: var(--border); border-radius: 50%; cursor: help; vertical-align: middle; }
    .info-icon:hover { background: var(--accent); color: #fff; }
    .gallery-row { display: flex; gap: 8px; margin-bottom: 8px; }
    .gallery-row input { margin-bottom: 0; }
    .shipping-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .shipping-grid input { margin-bottom: 0; }
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 100; align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }
    .modal-overlay.show { display: flex; }
    .modal { background: var(--surface); border-radius: var(--radius); padding: 24px; max-width: 520px; width: 100%; max-height: 95vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,.2); margin: auto; }
    .modal h3 { margin: 0 0 16px; }
    .card-section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
    .card-section h2 { margin: 0 0 12px; font-size: 1.05rem; font-weight: 700; }
    .inline-form { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 12px; }
    .inline-form input { margin-bottom: 0; flex: 1; min-width: 140px; }
    ul.mini-list { list-style: none; padding: 0; margin: 0; }
    ul.mini-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); }
    .mini-list .btn-small { padding: 4px 8px; font-size: 11px; }
    .summary-bar { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-bottom: 16px; color: var(--muted); font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-inner">
        <div>
          <h1>Praktico Admin</h1>
          <p>Catálogo como en la tienda: filtrá por categoría, hacé clic en Editar en cada producto.</p>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="muted" id="auth-user"></span>
          <button type="button" class="btn btn-secondary btn-small" id="btn-sync">Traer catálogo</button>
          <button type="button" class="btn btn-secondary btn-small" id="btn-git-toggle">Git / Token</button>
          <button type="button" class="btn btn-primary" id="btn-apply">Aplicar cambios</button>
          <button type="button" class="btn btn-secondary" id="btn-logout">Cerrar sesión</button>
        </div>
      </div>
    </header>

    <div class="card-section" id="git-section" style="display:none">
      <h2>Configurar GitHub</h2>
      <p class="muted">Token (PAT) para commit y push.</p>
      <p id="git-has-token" class="muted" style="display:none">Ô£ô Token guardado.</p>
      <input type="password" id="git-token" placeholder="ghp_xxxx..." autocomplete="off" style="max-width:320px"/>
      <button type="button" class="btn btn-primary" id="btn-save-token" style="margin-top:8px">Guardar token</button>
      <div id="token-status" class="status" style="display:none; margin-top:8px"></div>
    </div>

    <div class="summary-bar">
      <span>Productos: <strong id="product-count">—</strong></span>
      <span>Destacados: <strong id="featured-count">—</strong></span>
      <span id="apply-status" class="status" style="display:none; margin:0"></span>
    </div>

    <div class="toolbar">
      <button type="button" class="btn btn-primary" id="btn-add-product">+ Agregar producto</button>
      <button type="button" class="btn btn-secondary" id="btn-add-cat">+ Categoría</button>
      <button type="button" class="btn btn-secondary" id="btn-add-brand">+ Marca</button>
      <div class="filter-row" style="margin:0; margin-left:auto">
        <label for="filter-cat">Ver categoría:</label>
        <select id="filter-cat">
          <option value="">Todas</option>
        </select>
      </div>
    </div>

    <div class="product-grid" id="product-grid"></div>

    <div class="card-section" style="margin-top:24px">
      <h2>Categorías</h2>
      <div class="inline-form">
        <div style="flex:1; min-width:160px"><label>Nombre</label><input type="text" id="cat-name" placeholder="Nueva categoría"/></div>
        <button type="button" class="btn btn-primary" id="btn-add-cat-submit">Agregar</button>
      </div>
      <ul class="mini-list" id="cat-list"></ul>
    </div>
    <div class="card-section">
      <h2>Marcas</h2>
      <div class="inline-form">
        <div style="flex:1; min-width:160px"><label>Nombre</label><input type="text" id="brand-name" placeholder="Nueva marca"/></div>
        <button type="button" class="btn btn-primary" id="btn-add-brand-submit">Agregar</button>
      </div>
      <ul class="mini-list" id="brand-list"></ul>
    </div>
  </div>

  <div class="modal-overlay" id="product-modal">
    <div class="modal" onclick="event.stopPropagation()">
      <h3 id="product-modal-title">Agregar producto</h3>
      <input type="hidden" id="product-edit-slug"/>
      <div class="form-row"><label>Nombre</label><input type="text" id="product-name" required/></div>
      <div class="form-row"><label>Precio (CLP)</label><input type="number" id="product-price" min="0" step="1" required/></div>
      <div class="form-row"><label>Slug (URL) <span class="info-icon" title="Es la parte de la URL del producto. Ej: si ponés 'polera-blanca', la página será /productos/polera-blanca. Si lo dejás vacío se genera solo del nombre (minúsculas, sin tildes, espacios = guiones).">i</span></label><input type="text" id="product-slug" placeholder="se genera del nombre si lo dejás vacío"/></div>
      <div class="form-row"><label>URL foto principal</label><input type="url" id="product-image" placeholder="Pegá el enlace de la foto (subí la imagen, copiá el enlace)"/></div>
      <div class="form-row"><label>Más fotos (opcional)</label><div id="product-gallery-list"></div><button type="button" class="btn btn-secondary btn-small" id="product-add-photo">+ Agregar otra foto</button></div>
      <div class="form-row"><label>Descripción</label><textarea id="product-description"></textarea></div>
      <div class="form-row"><label>Marca</label><select id="product-brand"><option value="">— Ninguna —</option></select></div>
      <div class="form-row"><label>Categorías</label><div class="form-row checkboxes" id="product-categories"></div></div>
      <div class="form-row" style="margin-top:14px"><label style="margin-bottom:8px">Envío (para el cotizador)</label><div class="shipping-grid"><div class="form-row"><label>Peso (kg)</label><input type="number" id="product-weight" min="0" step="0.1" placeholder="0.5"/></div><div class="form-row"><label>Largo (cm)</label><input type="number" id="product-length" min="0" placeholder="20"/></div><div class="form-row"><label>Ancho (cm)</label><input type="number" id="product-width" min="0" placeholder="15"/></div><div class="form-row"><label>Alto (cm)</label><input type="number" id="product-height" min="0" placeholder="10"/></div></div></div>
      <div class="form-row" style="margin-top:14px"><div style="font-weight:700; margin-bottom:8px">Tipo de producto</div><div class="muted" style="margin-bottom:10px; font-size:0.9rem">Solo se puede elegir uno: físico (envío o retiro) o virtual/digital (solo datos + transferencia).</div><label style="display:flex; align-items:center; gap:10px; margin:6px 0; cursor:pointer"><input type="radio" name="product-type" id="product-type-physical" value="physical" style="width:18px; height:18px"/> Físico (envío o retiro en colegio)</label><label style="display:flex; align-items:center; gap:10px; margin:6px 0; cursor:pointer"><input type="radio" name="product-type" id="product-type-virtual" value="virtual" style="width:18px; height:18px"/> Virtual / digital (solo datos + transferencia)</label></div>
      <div class="form-row flex"><input type="checkbox" id="product-featured"/><label for="product-featured" style="cursor:pointer">Destacado (aparece en ofertas)</label></div>
      <div class="form-row flex"><input type="checkbox" id="product-soldout"/><label for="product-soldout" style="cursor:pointer">Agotado (no se puede comprar)</label></div>
      <div id="product-form-status" class="status" style="display:none; margin-bottom:12px"></div>
      <div style="display:flex; gap:8px;">
        <button type="button" class="btn btn-primary" id="product-save">Guardar</button>
        <button type="button" class="btn btn-secondary" id="product-cancel">Cancelar</button>
        <button type="button" class="btn btn-danger btn-small" id="product-delete" style="display:none">Borrar producto</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="quick-cat-modal">
    <div class="modal" onclick="event.stopPropagation()">
      <h3>Nueva categoría</h3>
      <div class="form-row"><label>Nombre</label><input type="text" id="quick-cat-name" placeholder="Ej: Hogar"/></div>
      <div id="quick-cat-status" class="status" style="display:none"></div>
      <div style="display:flex; gap:8px;"><button type="button" class="btn btn-primary" id="quick-cat-save">Guardar</button><button type="button" class="btn btn-secondary" id="quick-cat-cancel">Cancelar</button></div>
    </div>
  </div>
  <div class="modal-overlay" id="quick-brand-modal">
    <div class="modal" onclick="event.stopPropagation()">
      <h3>Nueva marca</h3>
      <div class="form-row"><label>Nombre</label><input type="text" id="quick-brand-name" placeholder="Ej: Marca X"/></div>
      <div id="quick-brand-status" class="status" style="display:none"></div>
      <div style="display:flex; gap:8px;"><button type="button" class="btn btn-primary" id="quick-brand-save">Guardar</button><button type="button" class="btn btn-secondary" id="quick-brand-cancel">Cancelar</button></div>
    </div>
  </div>

  <script>
    const API = '';
    let categories = [], brands = [], products = [];
    function escapeHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function getCategoryName(slug) { var c = categories.find(function(x) { return x.slug === slug; }); return c ? c.name : slug; }
    function getBrandName(slug) { var b = brands.find(function(x) { return x.slug === slug; }); return b ? b.name : slug; }

    async function loadAuth() {
      var me = await fetch(API + '/api/auth/me').then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });
      if (me && me.user) document.getElementById('auth-user').textContent = me.user;
      var git = await fetch(API + '/api/settings/git').then(function(r) { return r.json(); }).catch(function() { return { hasToken: false }; });
      if (git.hasToken) document.getElementById('git-has-token').style.display = 'block';
    }
    document.getElementById('btn-logout').onclick = function() {
      fetch(API + '/api/auth/logout', { method: 'POST' }).then(function() { window.location.href = '/login'; });
    };
    document.getElementById('btn-git-toggle').onclick = function() {
      var el = document.getElementById('git-section');
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    };
    document.getElementById('btn-save-token').onclick = async function() {
      var token = document.getElementById('git-token').value.trim();
      var statusEl = document.getElementById('token-status');
      statusEl.style.display = 'block';
      if (!token) { statusEl.className = 'status error'; statusEl.textContent = 'Escribí el token.'; return; }
      try {
        var r = await fetch(API + '/api/settings/git', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token }) });
        var d = await r.json();
        statusEl.className = 'status ' + (d.error ? 'error' : 'success');
        statusEl.textContent = d.error || d.message || 'Guardado.';
        if (!d.error) { document.getElementById('git-token').value = ''; document.getElementById('git-has-token').style.display = 'block'; }
      } catch (e) { statusEl.className = 'status error'; statusEl.textContent = e.message || 'Error'; }
    };

    function filteredProducts() {
      var cat = document.getElementById('filter-cat').value;
      if (!cat) return products;
      return products.filter(function(p) { return p.categories && p.categories.indexOf(cat) !== -1; });
    }

    function renderGalleryInputs(urls) {
      var list = document.getElementById('product-gallery-list');
      list.innerHTML = (urls || []).map(function(url, i) {
        return '<div class="gallery-row"><input type="url" class="product-gallery-url" placeholder="URL foto ' + (i + 1) + '" value="' + escapeHtml(url || '') + '"/><button type="button" class="btn btn-danger btn-small product-gallery-remove">Quitar</button></div>';
      }).join('');
      list.querySelectorAll('.product-gallery-remove').forEach(function(btn) {
        btn.onclick = function() { btn.closest('.gallery-row').remove(); };
      });
    }
    function showProductModal(editProduct) {
      document.getElementById('product-modal-title').textContent = editProduct ? 'Editar producto' : 'Agregar producto';
      document.getElementById('product-edit-slug').value = editProduct ? editProduct.slug : '';
      document.getElementById('product-name').value = editProduct ? editProduct.name : '';
      document.getElementById('product-price').value = editProduct ? (editProduct.price ?? '') : '';
      document.getElementById('product-slug').value = editProduct ? (editProduct.slug || '') : '';
      document.getElementById('product-image').value = editProduct ? (editProduct.image || '') : '';
      document.getElementById('product-description').value = editProduct ? (editProduct.description || '') : '';
      document.getElementById('product-featured').checked = !!editProduct && !!editProduct.featured;
      document.getElementById('product-soldout').checked = !!editProduct && !!editProduct.soldOut;
      var isVirtual = !!editProduct && !!editProduct.virtual;
      document.getElementById('product-type-physical').checked = !isVirtual;
      document.getElementById('product-type-virtual').checked = isVirtual;
      document.getElementById('product-delete').style.display = editProduct ? 'inline-flex' : 'none';
      var g = editProduct && editProduct.gallery && editProduct.gallery.length ? editProduct.gallery : [];
      renderGalleryInputs(g.length ? g : []);
      var ship = editProduct && editProduct.shipping ? editProduct.shipping : {};
      document.getElementById('product-weight').value = ship.weightKg != null ? ship.weightKg : '';
      document.getElementById('product-length').value = ship.lengthCm != null ? ship.lengthCm : '';
      document.getElementById('product-width').value = ship.widthCm != null ? ship.widthCm : '';
      document.getElementById('product-height').value = ship.heightCm != null ? ship.heightCm : '';
      var brandSel = document.getElementById('product-brand');
      brandSel.innerHTML = '<option value="">— Ninguna —</option>' + brands.map(function(b) {
        return '<option value="' + escapeHtml(b.slug) + '"' + (editProduct && editProduct.brand === b.slug ? ' selected' : '') + '>' + escapeHtml(b.name) + '</option>';
      }).join('');
      var catDiv = document.getElementById('product-categories');
      catDiv.innerHTML = categories.map(function(c) {
        var checked = editProduct && editProduct.categories && editProduct.categories.indexOf(c.slug) !== -1;
        return '<label><input type="checkbox" name="product-cat" value="' + escapeHtml(c.slug) + '"' + (checked ? ' checked' : '') + '> ' + escapeHtml(c.name) + '</label>';
      }).join('');
      document.getElementById('product-form-status').style.display = 'none';
      document.getElementById('product-modal').closest('.modal-overlay').classList.add('show');
    }
    document.getElementById('product-add-photo').onclick = function() {
      var list = document.getElementById('product-gallery-list');
      var row = document.createElement('div');
      row.className = 'gallery-row';
      row.innerHTML = '<input type="url" class="product-gallery-url" placeholder="Pegá el enlace de otra foto"/><button type="button" class="btn btn-danger btn-small product-gallery-remove">Quitar</button>';
      row.querySelector('.product-gallery-remove').onclick = function() { row.remove(); };
      list.appendChild(row);
    };
    function hideProductModal() {
      document.getElementById('product-modal').closest('.modal-overlay').classList.remove('show');
    }
    document.getElementById('btn-add-product').onclick = function() { showProductModal(null); };
    document.getElementById('product-cancel').onclick = hideProductModal;
    document.getElementById('product-modal').closest('.modal-overlay').onclick = function(e) { if (e.target === this) hideProductModal(); };
    document.getElementById('product-delete').onclick = async function() {
      if (!confirm('¿Borrar este producto?')) return;
      var slug = document.getElementById('product-edit-slug').value;
      try {
        await fetch(API + '/api/products/' + encodeURIComponent(slug), { method: 'DELETE' });
        hideProductModal();
        load();
      } catch (e) { alert(e.message); }
    };
    document.getElementById('product-save').onclick = async function() {
      var slug = document.getElementById('product-edit-slug').value.trim();
      var name = document.getElementById('product-name').value.trim();
      var price = Number(document.getElementById('product-price').value) || 0;
      var selectedCats = [].map.call(document.querySelectorAll('input[name="product-cat"]:checked'), function(cb) { return cb.value; });
      var galleryUrls = [].map.call(document.querySelectorAll('.product-gallery-url'), function(inp) { return inp.value.trim(); }).filter(Boolean);
      var weight = document.getElementById('product-weight').value;
      var length = document.getElementById('product-length').value;
      var width = document.getElementById('product-width').value;
      var height = document.getElementById('product-height').value;
      var shipping = (weight || length || width || height) ? {
        weightKg: weight ? Number(weight) : 0,
        lengthCm: length ? Number(length) : 0,
        widthCm: width ? Number(width) : 0,
        heightCm: height ? Number(height) : 0
      } : undefined;
      var statusEl = document.getElementById('product-form-status');
      statusEl.style.display = 'block';
      statusEl.className = 'status pending';
      statusEl.textContent = 'Guardando…';
      var payload = {
        name: name || 'Sin nombre',
        price: price,
        slug: document.getElementById('product-slug').value.trim() || undefined,
        image: document.getElementById('product-image').value.trim() || '/products/placeholder.svg',
        gallery: galleryUrls.length ? galleryUrls : undefined,
        description: document.getElementById('product-description').value.trim() || undefined,
        brand: document.getElementById('product-brand').value || undefined,
        categories: selectedCats,
        featured: document.getElementById('product-featured').checked,
        soldOut: document.getElementById('product-soldout').checked,
        virtual: document.getElementById('product-type-virtual').checked,
        shipping: shipping
      };
      try {
        if (slug) {
          var r = await fetch(API + '/api/products/' + encodeURIComponent(slug), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          var d = await r.json();
          if (d.error) throw new Error(d.error);
        } else {
          var r2 = await fetch(API + '/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          var d2 = await r2.json();
          if (d2.error) throw new Error(d2.error);
        }
        statusEl.className = 'status success';
        statusEl.textContent = 'Guardado.';
        setTimeout(function() { hideProductModal(); load(); }, 500);
      } catch (e) {
        statusEl.className = 'status error';
        statusEl.textContent = e.message || 'Error';
      }
    };

    function renderProductGrid() {
      var list = filteredProducts();
      var grid = document.getElementById('product-grid');
      grid.innerHTML = list.map(function(p) {
        var imgSrc = (p.image && p.image.indexOf('http') === 0) ? p.image : (p.image || '');
        var img = imgSrc ? '<img src="' + escapeHtml(imgSrc) + '" alt="" loading="lazy"/>' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:0.85rem;">Sin imagen</div>';
        var meta = [getBrandName(p.brand)].concat((p.categories || []).map(getCategoryName)).filter(Boolean).join(' · ');
        return '<article class="product-card" data-slug="' + escapeHtml(p.slug) + '"><a class="img-wrap" href="#">' + img + '</a><div class="card-body"><h2 class="card-title">' + escapeHtml(p.name) + (p.virtual ? ' <span class="badge" style="background:#0d47a1">Virtual</span>' : '') + (p.featured ? ' <span class="badge">Destacado</span>' : '') + (p.soldOut ? ' <span class="badge" style="background:#b71c1c">Agotado</span>' : '') + '</h2><div class="price">$' + (p.price != null ? Number(p.price).toLocaleString('es-CL') : '0') + '</div><div class="meta">' + escapeHtml(meta || '—') + '</div><div class="btn-row"><button type="button" class="btn btn-primary btn-small btn-edit">Editar</button></div></div></article>';
      }).join('');
      grid.querySelectorAll('.btn-edit').forEach(function(btn) {
        btn.onclick = function(e) { e.preventDefault(); var card = btn.closest('.product-card'); var slug = card && card.dataset.slug; var pr = products.find(function(x) { return x.slug === slug; }); if (pr) showProductModal(pr); };
      });
      grid.querySelectorAll('.product-card .img-wrap').forEach(function(a) {
        a.onclick = function(e) { e.preventDefault(); var card = a.closest('.product-card'); var slug = card && card.dataset.slug; var pr = products.find(function(x) { return x.slug === slug; }); if (pr) showProductModal(pr); };
      });
    }

    function renderFilter() {
      var sel = document.getElementById('filter-cat');
      var cur = sel.value;
      sel.innerHTML = '<option value="">Todas</option>' + categories.map(function(c) {
        return '<option value="' + escapeHtml(c.slug) + '">' + escapeHtml(c.name) + '</option>';
      }).join('');
      sel.value = cur || '';
    }

    function renderCategories() {
      document.getElementById('cat-list').innerHTML = categories.map(function(c) {
        return '<li><span>' + escapeHtml(c.name) + '</span><button type="button" class="btn btn-danger btn-small" data-cat-delete="' + escapeHtml(c.slug) + '">Borrar</button></li>';
      }).join('');
      document.getElementById('cat-list').querySelectorAll('[data-cat-delete]').forEach(function(btn) {
        btn.onclick = async function() {
          try { await fetch(API + '/api/categories/' + encodeURIComponent(btn.dataset.catDelete), { method: 'DELETE' }); load(); } catch (e) { alert(e.message); }
        };
      });
    }
    function renderBrands() {
      document.getElementById('brand-list').innerHTML = brands.map(function(b) {
        return '<li><span>' + escapeHtml(b.name) + '</span><button type="button" class="btn btn-danger btn-small" data-brand-delete="' + escapeHtml(b.slug) + '">Borrar</button></li>';
      }).join('');
      document.getElementById('brand-list').querySelectorAll('[data-brand-delete]').forEach(function(btn) {
        btn.onclick = async function() {
          try { await fetch(API + '/api/brands/' + encodeURIComponent(btn.dataset.brandDelete), { method: 'DELETE' }); load(); } catch (e) { alert(e.message); }
        };
      });
    }

    document.getElementById('btn-add-cat').onclick = function() {
      document.getElementById('quick-cat-name').value = '';
      document.getElementById('quick-cat-modal').classList.add('show');
    };
    document.getElementById('quick-cat-cancel').onclick = function() { document.getElementById('quick-cat-modal').classList.remove('show'); };
    document.getElementById('quick-cat-modal').onclick = function(e) { if (e.target === this) document.getElementById('quick-cat-modal').classList.remove('show'); };
    document.getElementById('quick-cat-save').onclick = async function() {
      var name = document.getElementById('quick-cat-name').value.trim();
      if (!name) return;
      try {
        await fetch(API + '/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name }) });
        document.getElementById('quick-cat-modal').classList.remove('show');
        load();
      } catch (e) { document.getElementById('quick-cat-status').style.display = 'block'; document.getElementById('quick-cat-status').className = 'status error'; document.getElementById('quick-cat-status').textContent = e.message; }
    };
    document.getElementById('btn-add-brand').onclick = function() {
      document.getElementById('quick-brand-name').value = '';
      document.getElementById('quick-brand-modal').classList.add('show');
    };
    document.getElementById('quick-brand-cancel').onclick = function() { document.getElementById('quick-brand-modal').classList.remove('show'); };
    document.getElementById('quick-brand-modal').onclick = function(e) { if (e.target === this) document.getElementById('quick-brand-modal').classList.remove('show'); };
    document.getElementById('quick-brand-save').onclick = async function() {
      var name = document.getElementById('quick-brand-name').value.trim();
      if (!name) return;
      try {
        await fetch(API + '/api/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name }) });
        document.getElementById('quick-brand-modal').classList.remove('show');
        load();
      } catch (e) { document.getElementById('quick-brand-status').style.display = 'block'; document.getElementById('quick-brand-status').className = 'status error'; document.getElementById('quick-brand-status').textContent = e.message; }
    };

    document.getElementById('btn-add-cat-submit').onclick = document.getElementById('btn-add-cat').onclick;
    document.getElementById('btn-add-brand-submit').onclick = document.getElementById('btn-add-brand').onclick;
    document.getElementById('filter-cat').onchange = function() { renderProductGrid(); };

    async function load() {
      await loadAuth();
      try {
        var prods = await fetch(API + '/api/products').then(function(r) { return r.json(); });
        var cats = await fetch(API + '/api/categories').then(function(r) { return r.json(); });
        var brds = await fetch(API + '/api/brands').then(function(r) { return r.json(); });
        products = Array.isArray(prods) ? prods : [];
        categories = Array.isArray(cats) ? cats : [];
        brands = Array.isArray(brds) ? brds : [];
        document.getElementById('product-count').textContent = products.length;
        document.getElementById('featured-count').textContent = products.filter(function(p) { return p.featured; }).length;
        renderFilter();
        renderProductGrid();
        renderCategories();
        renderBrands();
      } catch (e) {
        document.getElementById('product-count').textContent = 'Error';
      }
    }
    async function syncThenLoad() {
      var statusEl = document.getElementById('apply-status');
      statusEl.style.display = 'block';
      statusEl.className = 'status pending';
      statusEl.textContent = 'Traendo catálogo del repo…';
      try {
        var r = await fetch(API + '/api/sync', { method: 'POST' });
        var d = await r.json();
        if (d.ok) {
          statusEl.className = 'status success';
          statusEl.textContent = d.message || 'Catálogo actualizado.';
        } else {
          statusEl.className = 'status error';
          statusEl.textContent = d.error || 'Error';
        }
      } catch (e) {
        statusEl.className = 'status error';
        statusEl.textContent = e.message || 'Error de red';
      }
      await load();
    }
    document.getElementById('btn-sync').onclick = function() {
      syncThenLoad();
    };
    document.getElementById('btn-apply').onclick = async function() {
      var btn = this;
      var statusEl = document.getElementById('apply-status');
      statusEl.style.display = 'block';
      statusEl.className = 'status pending';
      statusEl.textContent = 'Aplicando…';
      btn.disabled = true;
      try {
        var res = await fetch(API + '/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        var data = await res.json();
        statusEl.className = 'status ' + (data.ok ? 'success' : 'error');
        statusEl.textContent = data.ok
          ? (data.message || ('+ ' + (data.changes || 0) + ' cambio(s)' + (data.pushed ? ' subidos.' : (data.pushError ? ' Push: ' + data.pushError : ''))))
          : (data.error || 'Error');
      } catch (e) {
        statusEl.className = 'status error';
        statusEl.textContent = e.message || 'Error de red';
      }
      btn.disabled = false;
      load();
    };
    syncThenLoad();
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
