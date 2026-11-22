<p align="center"><img src="https://raw.githubusercontent.com/Joacoorandom/Joacoorandom/main/assets/projects/praktico.svg" width="100%" alt="Praktico — catálogo, pedidos y web" /></p>

# Praktico

**Simplicidad a tu alcance.** Catálogo web con filtros por marca y categoría, ofertas y flujo de pedidos. Construido con **Next.js 14, React 18 y TypeScript**.

**[Explorar la tienda ↗](https://praktico.vercel.app)** · [Mi perfil](https://github.com/Joacoorandom)

## Desarrollo local

Necesitas una versión de Node.js compatible con Next.js 14 y npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Abre **http://localhost:3000**. Revisa [`.env.example`](.env.example) para configurar la URL pública, la cotización de envíos y las notificaciones de pedidos. El checkout necesita `DISCORD_WEBHOOK_URL` para enviar los pedidos; sin `CHILEXPRESS_API_KEY`, el cotizador utiliza una tarifa estimada.

Guarda las credenciales en `.env.local` o en las variables del alojamiento; no las publiques en el repositorio.

## Comandos

| Comando | Para qué sirve |
| :--- | :--- |
| `npm run dev` | Iniciar el servidor de desarrollo. |
| `npm run build` | Crear la versión de producción. |
| `npm start` | Servir la versión compilada. |
| `npm run lint` | Revisar el código con la configuración de Next.js. |
| `npm run catalog:list` | Listar productos del catálogo. |
| `npm run catalog:validate` | Validar el catálogo. |
| `npm run catalog:add` | Abrir la herramienta de gestión del catálogo. |

## Dónde trabajar

| Carpeta o archivo | Contenido |
| :--- | :--- |
| [`app/`](app/) | Páginas y rutas de la aplicación Next.js. |
| [`src/components/`](src/components/) | Interfaz del catálogo, ofertas y productos. |
| [`src/config/store.ts`](src/config/store.ts) | Nombre de la tienda y configuración comercial. |
| [`scripts/catalog.mjs`](scripts/catalog.mjs) | Herramienta de gestión de productos. |
| [`public/`](public/) | Recursos públicos de la tienda. |

Para producción, ejecuta `npm run build` y después `npm start`, o configura el proyecto como una aplicación Next.js en tu alojamiento.
