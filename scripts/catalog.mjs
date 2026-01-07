import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

// CLI interactivo (flechas) + colores
import { select, input, confirm, checkbox } from "@inquirer/prompts";
import kleur from "kleur";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const PRODUCTS_PATH = path.join(repoRoot, "src", "data", "products.json");
const BRANDS_PATH = path.join(repoRoot, "src", "data", "brands.json");
const CATEGORIES_PATH = path.join(repoRoot, "src", "data", "categories.json");
const PUBLIC_DIR = path.join(repoRoot, "public");

function usage() {
  return `
Uso:
  node scripts/catalog.mjs
  node scripts/catalog.mjs menu
  node scripts/catalog.mjs list
  node scripts/catalog.mjs validate
  node scripts/catalog.mjs add
  node scripts/catalog.mjs remove
  node scripts/catalog.mjs brands
  node scripts/catalog.mjs categories

Notas:
  - Si ejecutas sin comando, se abre un menú por número (recomendado).
  - El modo interactivo usa flechas y colores.
  - Permite imágenes por URL (https://...) además de /public.
`.trim();
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  const raw = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(filePath, raw, "utf8");
}

function slugify(inputStr) {
  return String(inputStr || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function ensureArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`Formato inválido en ${name}: se esperaba un array.`);
  }
}

function nextId(products) {
  const nums = products
    .map((p) => String(p?.id || ""))
    .map((id) => {
      const m = /^p-(\d+)$/.exec(id);
      return m ? Number(m[1]) : null;
    })
    .filter((n) => typeof n === "number" && Number.isFinite(n));
  if (nums.length === 0) return "p-1";
  return `p-${Math.max(...nums) + 1}`;
}

function isHttpUrl(s) {
  return /^https?:\/\//i.test(String(s || ""));
}

function validateProducts(products, brands, categories) {
  const errors = [];
  const ids = new Set();
  const slugs = new Set();
  const brandSlugs = new Set((brands || []).map((b) => b.slug));
  const categorySlugs = new Set((categories || []).map((c) => c.slug));

  for (const p of products) {
    if (!p || typeof p !== "object") {
      errors.push("Producto inválido: no es un objeto.");
      continue;
    }

    for (const field of ["id", "slug", "name", "image", "description"]) {
      if (typeof p[field] !== "string" || !p[field].trim()) {
        errors.push(`Producto inválido: campo "${field}" faltante o vacío (id: ${p.id || "?"}).`);
      }
    }

    if (typeof p.price !== "number" || !Number.isFinite(p.price) || p.price <= 0) {
      errors.push(`Precio inválido (debe ser número > 0): "${p.price}" (slug: ${p.slug || "?"}).`);
    }

    if (typeof p.id === "string") {
      if (ids.has(p.id)) errors.push(`ID duplicado: "${p.id}".`);
      ids.add(p.id);
    }

    if (typeof p.slug === "string") {
      if (slugs.has(p.slug)) errors.push(`Slug duplicado: "${p.slug}".`);
      slugs.add(p.slug);
    }

    if (typeof p.image === "string" && p.image.startsWith("/") && !isHttpUrl(p.image)) {
      const diskPath = path.join(PUBLIC_DIR, p.image);
      if (!fs.existsSync(diskPath)) {
        errors.push(`Imagen no existe en disco: "${p.image}" (esperado: ${diskPath}).`);
      }
    }

    if (Array.isArray(p.gallery)) {
      for (const g of p.gallery) {
        if (typeof g !== "string" || (!g.startsWith("/") && !isHttpUrl(g))) {
          errors.push(`Gallery inválida (debe ser "/..." o "https://..."): "${String(g)}" (slug: ${p.slug || "?"}).`);
          continue;
        }
        if (g.startsWith("/") && !isHttpUrl(g)) {
          const diskPath = path.join(PUBLIC_DIR, g);
          if (!fs.existsSync(diskPath)) {
            errors.push(`Imagen de gallery no existe: "${g}" (slug: ${p.slug || "?"}).`);
          }
        }
      }
    }

    if (p.shipping != null) {
      const s = p.shipping;
      const fields = ["lengthCm", "widthCm", "heightCm", "weightKg"];
      for (const f of fields) {
        const v = s?.[f];
        if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
          errors.push(`Shipping inválido: "${f}" debe ser número > 0 (slug: ${p.slug || "?"}).`);
        }
      }
    }

    if (p.brand && typeof p.brand === "string" && p.brand.trim()) {
      if (!brandSlugs.has(p.brand)) errors.push(`Marca inexistente: "${p.brand}" (slug: ${p.slug || "?"}).`);
    }

    if (p.categories != null) {
      if (!Array.isArray(p.categories)) {
        errors.push(`categories debe ser array (slug: ${p.slug || "?"}).`);
      } else {
        for (const c of p.categories) {
          if (typeof c !== "string" || !c.trim()) continue;
          if (!categorySlugs.has(c)) errors.push(`Categoría inexistente: "${c}" (slug: ${p.slug || "?"}).`);
        }
      }
    }
  }

  return errors;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writePlaceholderSvg(outputPath, label) {
  const safeLabel = String(label || "Producto").slice(0, 24);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <rect width="900" height="600" fill="#f5f5f5"/>
  <rect x="140" y="120" width="620" height="360" rx="40" fill="#ffffff" stroke="#111111" stroke-width="10"/>
  <text x="450" y="330" font-family="ui-sans-serif, system-ui" font-size="48" text-anchor="middle" fill="#111111">${safeLabel}</text>
</svg>
`;
  fs.writeFileSync(outputPath, svg, "utf8");
}

function header(title) {
  console.log("");
  console.log(kleur.bold().white(`=== ${title} ===`));
  console.log(kleur.gray("Usa ↑/↓ para navegar, Enter para seleccionar."));
  console.log("");
}

function copyIntoPublicProducts(srcPath, destBaseName) {
  const publicProductsDir = path.join(PUBLIC_DIR, "products");
  ensureDir(publicProductsDir);

  const src = path.resolve(process.cwd(), srcPath);
  if (!fs.existsSync(src)) throw new Error(`No existe el archivo: ${src}`);
  const ext = path.extname(src) || ".jpg";
  const destName = `${destBaseName}${ext}`;
  const dest = path.join(publicProductsDir, destName);
  fs.copyFileSync(src, dest);
  return `/products/${destName}`;
}

function loadBrands() {
  const data = fs.existsSync(BRANDS_PATH) ? readJson(BRANDS_PATH) : [];
  ensureArray(data, BRANDS_PATH);
  return data;
}

function loadCategories() {
  const data = fs.existsSync(CATEGORIES_PATH) ? readJson(CATEGORIES_PATH) : [];
  ensureArray(data, CATEGORIES_PATH);
  return data;
}

function nextSimpleId(prefix, arr) {
  const nums = arr
    .map((x) => String(x?.id || ""))
    .map((id) => {
      const m = new RegExp(`^${prefix}-(\\\\d+)$`).exec(id);
      return m ? Number(m[1]) : null;
    })
    .filter((n) => typeof n === "number" && Number.isFinite(n));
  if (nums.length === 0) return `${prefix}-1`;
  return `${prefix}-${Math.max(...nums) + 1}`;
}

async function cmdMenu() {
  header("Catálogo Praktico");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const action = await select({
      message: "¿Qué quieres hacer?",
      choices: [
        { name: "Productos", value: "products" },
        { name: "Marcas", value: "brands" },
        { name: "Categorías", value: "categories" },
        { name: kleur.gray("Validar catálogo"), value: "validate" },
        { name: kleur.gray("Salir"), value: "exit" }
      ]
    });

    if (action === "exit") return;
    if (action === "validate") await cmdValidate();
    if (action === "products") await menuProducts();
    if (action === "brands") await menuBrands();
    if (action === "categories") await menuCategories();
  }
}

async function cmdList() {
  const products = readJson(PRODUCTS_PATH);
  ensureArray(products, PRODUCTS_PATH);

  const rows = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    price: p.price,
    name: p.name
  }));

  console.table(rows);
  console.log(`Total: ${products.length}`);
}

async function cmdValidate() {
  const products = readJson(PRODUCTS_PATH);
  ensureArray(products, PRODUCTS_PATH);

  const brands = loadBrands();
  const categories = loadCategories();

  const errors = validateProducts(products, brands, categories);
  if (errors.length === 0) {
    console.log(kleur.green("OK: catálogo válido."));
    return;
  }

  console.error(kleur.red(`Se encontraron ${errors.length} problema(s):`));
  for (const e of errors) console.error(kleur.red(`- ${e}`));
  process.exitCode = 1;
}

async function chooseMainImage(slugBase, name) {
  const mode = await select({
    message: "Imagen principal",
    choices: [
      { name: "Crear placeholder automático", value: "placeholder" },
      { name: "Copiar archivo local a /public/products/", value: "copy" },
      { name: "Usar ruta en /public (ej: /products/mi.jpg)", value: "public" },
      { name: "Usar URL (https://...)", value: "url" }
    ]
  });

  if (mode === "public") {
    const p = (await input({ message: "Ruta pública:", default: `/products/${slugBase}.jpg` })).trim();
    return p;
  }
  if (mode === "url") {
    const u = (await input({ message: "URL de imagen (https://...):" })).trim();
    if (!isHttpUrl(u)) throw new Error("La URL debe empezar con http:// o https://");
    return u;
  }
  if (mode === "copy") {
    const filePath = (await input({ message: "Ruta del archivo local (ej: ./foto.jpg):" })).trim();
    return copyIntoPublicProducts(filePath, slugBase);
  }

  // placeholder
  const publicProductsDir = path.join(PUBLIC_DIR, "products");
  ensureDir(publicProductsDir);
  const destName = `${slugBase}.svg`;
  const dest = path.join(publicProductsDir, destName);
  writePlaceholderSvg(dest, name);
  return `/products/${destName}`;
}

async function chooseGallery(slugBase) {
  const wants = await confirm({ message: "¿Agregar galería de fotos extra?", default: false });
  if (!wants) return [];

  const countStr = (await input({ message: "¿Cuántas fotos extra? (0-12)", default: "2" })).trim();
  const count = Math.max(0, Math.min(12, Number(countStr) || 0));
  if (!count) return [];

  const items = [];
  for (let i = 0; i < count; i++) {
    const value = (await input({ message: `Foto ${i + 1}/${count} (URL https://... o ruta /products/... o ruta local ./...):` })).trim();
    if (!value) continue;
    if (isHttpUrl(value) || value.startsWith("/")) {
      items.push(value);
    } else {
      items.push(copyIntoPublicProducts(value, `${slugBase}-${i + 1}`));
    }
  }
  return items;
}

async function cmdAddInteractive() {
  const products = readJson(PRODUCTS_PATH);
  ensureArray(products, PRODUCTS_PATH);
  const brands = loadBrands();
  const categories = loadCategories();

  header("Agregar producto");
  console.log(kleur.gray("Tip: puedes pegar URLs de imágenes (https://...) o rutas /products/..."));
  console.log("");

  const name = (await input({ message: "Nombre del producto:", validate: (v) => (v.trim() ? true : "Obligatorio") })).trim();
  const priceRaw = (await input({ message: "Precio CLP (ej: 14990):", validate: (v) => (/^\d+$/.test(v.trim()) ? true : "Solo números") })).trim();
  const parsedPrice = Number(priceRaw);

  const slugRaw = (await input({ message: "Slug (Enter para autogenerar):", default: slugify(name) })).trim();
  const computedSlug = slugify(slugRaw) || slugify(name);
  if (!computedSlug) throw new Error("No se pudo generar slug.");
  if (products.some((p) => p.slug === computedSlug)) throw new Error(`Ya existe un producto con slug "${computedSlug}".`);

  const description = (await input({ message: "Descripción:", default: "Descripción pendiente." })).trim();

  const id = nextId(products);

  const image = (await chooseMainImage(computedSlug, name)).trim();

  const brand = await select({
    message: "Marca",
    choices: [
      ...brands.map((b) => ({ name: b.name, value: b.slug })),
      { name: kleur.gray("— Sin marca —"), value: "" }
    ]
  });

  const selectedCategories = await checkbox({
    message: "Categorías (puedes elegir varias)",
    choices: categories.map((c) => ({ name: c.name, value: c.slug }))
  });

  const gallery = await chooseGallery(computedSlug);

  const wantsShipping = await confirm({ message: "¿Agregar datos de envío (cm/kg) para cotizador?", default: true });
  let shipping = undefined;
  if (wantsShipping) {
    const lengthCm = Number((await input({ message: "Largo (cm):", default: "10" })).trim());
    const widthCm = Number((await input({ message: "Ancho (cm):", default: "10" })).trim());
    const heightCm = Number((await input({ message: "Alto (cm):", default: "10" })).trim());
    const weightKg = Number((await input({ message: "Peso (kg, ej: 0.35):", default: "0.3" })).trim().replace(",", "."));
    shipping = { lengthCm, widthCm, heightCm, weightKg };
  }

  const newProduct = {
    id: products.some((p) => p.id === id) ? crypto.randomUUID() : id,
    slug: computedSlug,
    name,
    price: parsedPrice,
    image,
    description,
    ...(brand ? { brand } : {}),
    ...(selectedCategories?.length ? { categories: selectedCategories } : {}),
    ...(gallery?.length ? { gallery } : {}),
    ...(shipping ? { shipping } : {})
  };

  const next = [...products, newProduct];
  const errors = validateProducts(next, brands, categories);
  if (errors.length > 0) {
    throw new Error(`No se pudo agregar: catálogo quedaría inválido.\n${errors.map((e) => `- ${e}`).join("\n")}`);
  }

  writeJson(PRODUCTS_PATH, next);

  console.log("");
  console.log(kleur.green("Producto agregado:"));
  console.log(kleur.gray(`- slug: ${newProduct.slug}`));
}

async function cmdRemoveProduct() {
  const products = readJson(PRODUCTS_PATH);
  ensureArray(products, PRODUCTS_PATH);

  if (products.length === 0) {
    console.log(kleur.yellow("No hay productos para eliminar."));
    return;
  }

  header("Eliminar producto");

  const slug = await select({
    message: "Selecciona el producto a eliminar",
    choices: products.map((p) => ({
      name: `${p.name} (${p.slug})`,
      value: p.slug
    }))
  });

  const ok = await confirm({ message: `¿Eliminar "${slug}"?`, default: false });
  if (!ok) return;

  const next = products.filter((p) => p.slug !== slug);
  writeJson(PRODUCTS_PATH, next);
  console.log(kleur.green("Producto eliminado."));
}

async function menuProducts() {
  header("Productos");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const action = await select({
      message: "Acción",
      choices: [
        { name: "Listar", value: "list" },
        { name: "Agregar", value: "add" },
        { name: "Eliminar", value: "remove" },
        { name: kleur.gray("Volver"), value: "back" }
      ]
    });
    if (action === "back") return;
    if (action === "list") await cmdList();
    if (action === "add") await cmdAddInteractive();
    if (action === "remove") await cmdRemoveProduct();
  }
}

async function menuBrands() {
  header("Marcas");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const action = await select({
      message: "Acción",
      choices: [
        { name: "Listar", value: "list" },
        { name: "Crear", value: "add" },
        { name: "Eliminar", value: "remove" },
        { name: kleur.gray("Volver"), value: "back" }
      ]
    });
    if (action === "back") return;
    if (action === "list") {
      const brands = loadBrands();
      console.table(brands.map((b) => ({ id: b.id, slug: b.slug, name: b.name })));
    }
    if (action === "add") {
      const brands = loadBrands();
      const name = (await input({ message: "Nombre de marca:", validate: (v) => (v.trim() ? true : "Obligatorio") })).trim();
      const slug = slugify((await input({ message: "Slug (Enter para autogenerar):", default: slugify(name) })).trim() || name);
      if (brands.some((b) => b.slug === slug)) throw new Error(`Ya existe la marca "${slug}".`);
      const id = nextSimpleId("b", brands);
      const next = [...brands, { id, slug, name }];
      writeJson(BRANDS_PATH, next);
      console.log(kleur.green("Marca creada."));
    }
    if (action === "remove") {
      const brands = loadBrands();
      if (brands.length === 0) return;
      const products = readJson(PRODUCTS_PATH);
      ensureArray(products, PRODUCTS_PATH);

      const slug = await select({
        message: "Marca a eliminar",
        choices: brands.map((b) => ({ name: `${b.name} (${b.slug})`, value: b.slug }))
      });

      const used = products.some((p) => p.brand === slug);
      if (used) {
        console.log(kleur.red("No se puede eliminar: hay productos usando esta marca."));
        continue;
      }
      const ok = await confirm({ message: `¿Eliminar marca "${slug}"?`, default: false });
      if (!ok) continue;
      writeJson(BRANDS_PATH, brands.filter((b) => b.slug !== slug));
      console.log(kleur.green("Marca eliminada."));
    }
  }
}

async function menuCategories() {
  header("Categorías");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const action = await select({
      message: "Acción",
      choices: [
        { name: "Listar", value: "list" },
        { name: "Crear", value: "add" },
        { name: "Eliminar", value: "remove" },
        { name: kleur.gray("Volver"), value: "back" }
      ]
    });
    if (action === "back") return;
    if (action === "list") {
      const cats = loadCategories();
      console.table(cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name })));
    }
    if (action === "add") {
      const cats = loadCategories();
      const name = (await input({ message: "Nombre de categoría:", validate: (v) => (v.trim() ? true : "Obligatorio") })).trim();
      const slug = slugify((await input({ message: "Slug (Enter para autogenerar):", default: slugify(name) })).trim() || name);
      if (cats.some((c) => c.slug === slug)) throw new Error(`Ya existe la categoría "${slug}".`);
      const id = nextSimpleId("c", cats);
      const next = [...cats, { id, slug, name }];
      writeJson(CATEGORIES_PATH, next);
      console.log(kleur.green("Categoría creada."));
    }
    if (action === "remove") {
      const cats = loadCategories();
      if (cats.length === 0) return;
      const products = readJson(PRODUCTS_PATH);
      ensureArray(products, PRODUCTS_PATH);

      const slug = await select({
        message: "Categoría a eliminar",
        choices: cats.map((c) => ({ name: `${c.name} (${c.slug})`, value: c.slug }))
      });

      const used = products.some((p) => Array.isArray(p.categories) && p.categories.includes(slug));
      if (used) {
        console.log(kleur.red("No se puede eliminar: hay productos usando esta categoría."));
        continue;
      }
      const ok = await confirm({ message: `¿Eliminar categoría "${slug}"?`, default: false });
      if (!ok) continue;
      writeJson(CATEGORIES_PATH, cats.filter((c) => c.slug !== slug));
      console.log(kleur.green("Categoría eliminada."));
    }
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) return cmdMenu();
  if (cmd === "menu") return cmdMenu();
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(usage());
    return;
  }

  if (!fs.existsSync(PRODUCTS_PATH)) {
    throw new Error(`No existe el catálogo en ${PRODUCTS_PATH}`);
  }

  if (cmd === "list") return cmdList();
  if (cmd === "validate") return cmdValidate();
  if (cmd === "add") return cmdAddInteractive();
  if (cmd === "remove") return cmdRemoveProduct();
  if (cmd === "brands") return menuBrands();
  if (cmd === "categories") return menuCategories();

  console.error(`Comando desconocido: ${cmd}`);
  console.log(usage());
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exitCode = 1;
});

