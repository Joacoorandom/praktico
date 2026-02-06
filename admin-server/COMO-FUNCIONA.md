# Cómo funciona el admin con Praktico en Vercel

Praktico (la tienda) corre en **Next.js en Vercel**. El sistema admin es un **servidor Node.js aparte**. Aquí van las dos formas de hacer que convivan.

---

## Situación actual: todo con JSON en el repo

Hoy la tienda **no** lee del servidor admin. Hace esto:

1. En el código tenés `import productsJson from "@/data/products.json"`.
2. Cuando hacés **build** en Vercel, ese JSON se mete en el bundle.
3. La tienda sirve **siempre la misma lista de productos** hasta que hagas un **nuevo deploy** con el `products.json` actualizado.

El **admin-server** (Node.js) puede estar en tu PC, en un VPS, Railway, Render, etc. Cuando lo corrés, lee y escribe los archivos en `src/data/` (productos, categorías, marcas). Esos archivos son los del **mismo repo** donde está la tienda.

### Flujo típico (todo con JSON en el repo)

```
[Tu PC]
  - Corrés admin-server (npm start en admin-server/)
  - En la API del admin agregás/editas productos, destacados, fotos
  - El admin escribe en src/data/products.json (y categorías, marcas)

  - Hacés commit + push de esos JSON
  - Vercel hace un nuevo deploy de la tienda Next.js
  - La tienda “ve” el nuevo products.json porque quedó en el build

Resultado: la tienda en Vercel muestra los cambios después del próximo deploy.
```

**Resumen:** el admin no “le da” el JSON a Vercel en vivo. Vercel solo ve el JSON que está en el repo en el momento del **build**. Por eso, para que los cambios del admin se vean en la tienda, tenés que:

- tener los JSON actualizados en el repo (el admin escribe en tu copia local y vos hacés commit + push), **o**
- tener algún proceso que, después de que el admin guarde, actualice el repo (por ejemplo un script que haga commit desde el servidor donde corre el admin).

No hay “un JSON que lee del servidor Node” en tiempo real si la tienda sigue usando solo `import ... from "@/data/products.json"`.

---

## Alternativa: que la tienda lea del admin en tiempo real

Si querés que los cambios del admin se vean **sin hacer deploy** cada vez, la tienda tiene que dejar de usar el JSON del build y **pedir los datos en runtime** al servidor admin (o a una API que use los mismos datos).

### Cómo sería

1. **Admin-server** sigue siendo la “fuente de verdad”: guarda productos (en JSON, en base de datos, o en R2, lo que sea).
2. El admin expone algo como:  
   `GET https://tu-admin.ejemplo.com/api/products`
3. **La tienda Next.js** en Vercel, en lugar de importar el JSON, hace por ejemplo:
   - en el servidor (Server Component o `getServerSideProps`):  
     `const res = await fetch(process.env.CATALOG_API_URL + '/api/products')`  
   - y usa esa respuesta para renderizar la página.

Ahí sí: **la tienda “lee del servidor Node”** (del admin) en cada request (o con cache de unos minutos, si lo implementás). No usa un JSON fijo del build.

### Qué necesitás para eso

- **Admin-server** desplegado en un sitio con URL pública (Railway, Render, Fly.io, un VPS, etc.).
- En Vercel, variable de entorno para la tienda, por ejemplo:  
  `CATALOG_API_URL=https://tu-admin.ejemplo.com`
- En el código de la tienda, cambiar `getProducts()` para que:
  - si existe `CATALOG_API_URL`, haga `fetch` a esa API y devuelva eso;
  - si no existe (desarrollo local sin admin), siga usando el JSON de `src/data/`.

Así tenés **un solo lugar** donde se edita el catálogo (el admin Node.js) y la tienda en Vercel **siempre lee de ese servidor**; no depende del JSON en el repo en el momento del build.

---

## Resumen rápido

| Enfoque | Quién guarda los datos | Quién lee los datos en la tienda | Cuándo se ven los cambios |
|--------|-------------------------|-----------------------------------|----------------------------|
| **Solo JSON en repo (actual)** | Admin escribe en `src/data/*.json` (en tu repo) | Next.js importa el JSON en el **build** | Después de un **nuevo deploy** en Vercel (con el repo actualizado). |
| **Tienda lee del admin** | Admin-server (Node) guarda en sus archivos/DB | Next.js hace **fetch** a la API del admin en **runtime** | En la **siguiente carga** de la tienda (o cuando expire la cache si la ponés). |

Si querés, en un siguiente paso se puede implementar en la tienda la opción de `CATALOG_API_URL` para que lea del admin en tiempo real y dejar el JSON como fallback cuando no esté definida esa variable.
