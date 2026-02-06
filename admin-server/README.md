# Praktico Admin Server

Servidor Node.js para administrar el catálogo y **aplicar cambios** al repo (commit + push). Protegido por **inicio de sesión**; el **token de GitHub** se configura desde la misma UI (guardado solo en el servidor).

## Arrancar

```bash
cd admin-server
npm install
npm start
```

Abrí **http://localhost:25574** (o la URL que asigne tu panel; el puerto por defecto es 25574). Si no estás logueado, te redirige a **/login**. Tras iniciar sesión ves el panel: resumen, productos, **Configurar GitHub** (guardar token para commit/push) y **Aplicar cambios**.

**Pterodactyl (sin SSH):** en la raíz del repo hay un **`main.js`** que ejecuta `npm install` en `admin-server` y luego inicia el servidor. Configurá el comando de inicio del servidor como **`node main.js`** (directorio de trabajo = raíz del repo). Así no hace falta SSH para instalar dependencias. Alternativa: `bash admin-server/start.sh`.

## Login y protección

Todo el panel está protegido. Podés usar **varios usuarios** con `ADMIN_USERS` o uno solo con `ADMIN_USER` + `ADMIN_PASSWORD`.

**Dos usuarios (chris y joaco)** — en el panel configurá la variable:

- **`ADMIN_USERS`** = `chris:Wp4kL9mN,joaco:Q2vR7xJz`

Credenciales:

| Usuario | Contraseña |
|--------|------------|
| **chris** | `Wp4kL9mN` |
| **joaco**  | `Q2vR7xJz` |

(Guardá las contraseñas en un gestor; podés cambiarlas editando el valor de `ADMIN_USERS` en el panel.)

Alternativa, un solo usuario:

- `ADMIN_USER` – Usuario para iniciar sesión.
- `ADMIN_PASSWORD` – Contraseña.
- `SESSION_SECRET` – Secreto para firmar la cookie de sesión (recomendado en producción).
- `SESSION_SECURE` – Si es `true`, la cookie solo se envía por HTTPS.

Sin `ADMIN_USERS` ni `ADMIN_USER`/`ADMIN_PASSWORD` configurados no se puede entrar; el login devuelve error.

## Token de GitHub (para commit/push)

En la UI, en **Configurar GitHub**, pegás un [Personal Access Token](https://github.com/settings/tokens) de GitHub (con permiso `repo`). Se guarda en el servidor en `admin-server/data/github-token.txt` (esa carpeta está en `.gitignore`). Al hacer **Aplicar cambios**, el servidor usa ese token solo para el `git push` (pone y quita el token en el remote, no lo deja en `.git/config`).

En Docker conviene montar un volumen en `admin-server/data/` para que el token persista entre reinicios.

## Variables de entorno

- `PORT` – Puerto del servidor web (default: 25574). En Pterodactyl asigná el puerto 25574 al contenedor; 25573 queda libre por si lo necesitás.
- `DATA_PATH` – Ruta absoluta a la carpeta de datos. Por defecto: `../src/data`.
- `ADMIN_DATA_DIR` – Donde se guarda el token (default: `admin-server/data`).
- `GIT_USER_NAME` / `GIT_USER_EMAIL` – Nombre y email del commit (default: "Praktico Admin" / "admin@praktico.shop")

El remoto debe ser HTTPS (ej. `https://github.com/usuario/praktico.git`). Si usás SSH, el token de la UI no aplica; tendrías que configurar deploy key en el servidor.

## API

- `GET /api/products` – Listar productos
- `GET /api/products/:slug` – Un producto
- `POST /api/products` – Crear producto (body: name, price, slug?, image, description?, brand?, categories?, gallery?, featured?, shipping?)
- `PATCH /api/products/:slug` – Actualizar (cualquier campo: featured, gallery, name, etc.)
- `DELETE /api/products/:slug` – Borrar producto
- `GET /api/categories` – Listar categorías
- `POST /api/categories` – Crear (name, slug?)
- `DELETE /api/categories/:slug` – Borrar categoría
- `GET /api/brands` – Listar marcas
- `POST /api/brands` – Crear (name, slug?)
- `GET /api/featured` – Productos con `featured: true`
- `PATCH /api/products/:slug/featured` – Marcar/desmarcar destacado (body: `{ "featured": true }`)
- `GET /api/health` – Estado y `dataPath`

## Imágenes y R2

- **Imagen principal** (`image`): puede ser ruta `/products/foto.jpg` o URL `https://...` (por ejemplo R2).
- **Galería** (`gallery`): array de rutas o URLs. En el detalle del producto se muestran con flechas (foto1, foto2, …).

Convención **foto1, foto2** en un “directorio”:

- **Local:** en `public/products/<slug>/` puedes tener `foto1.jpg`, `foto2.jpg` y en el producto usar `image: "/products/mi-slug/foto1.jpg"` y `gallery: ["/products/mi-slug/foto2.jpg", ...]`.
- **R2:** subes a tu bucket (ej. `products/<slug>/foto1.jpg`, `foto2.jpg`), habilitas acceso público o dominios custom, y en el producto pones esas URLs en `image` y `gallery`. El servidor admin no sube a R2; tú subes (dashboard R2, CLI, o otro script) y aquí solo guardas las URLs.

## Destacados

En `products.json`, los productos con `"featured": true` salen en el panel de ofertas de la tienda. Para marcar/desmarcar usa:

```bash
curl -X PATCH http://localhost:25574/api/products/taza-ceramica/featured -H "Content-Type: application/json" -d '{"featured": true}'
```

O `PATCH /api/products/:slug` con `{ "featured": true }`.

## Uso con el script del repo

El script `scripts/catalog.mjs` del repo principal sigue siendo CLI interactivo (agregar producto, categorías, etc.). Este servidor expone la misma lógica por HTTP para que puedas:

- Usar una mini UI o scripts que llamen a la API.
- Dejar el servidor admin corriendo en un puerto y la tienda Next en otro; la tienda sigue leyendo `src/data/*.json` (al guardar desde el admin, actualizas esos JSON).

Si quieres que la tienda lea desde la API en vez de JSON estático, en `getProducts()` tendrías que hacer `fetch('http://localhost:25574/api/products')` (o la URL que uses); por defecto la tienda usa los JSON del build.
