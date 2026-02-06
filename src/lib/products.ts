import productsJson from "@/data/products.json";

export type Product = {
  id: string;
  slug: string;
  name: string;
  price: number; // CLP
  image: string; // ruta en /public o URL (https://...)
  description: string;
  // Secciones del catálogo (opcional)
  brand?: string; // slug de marca
  categories?: string[]; // slugs de categorías
  // Opcional: galería extra para el detalle del producto (rutas /public o URLs, ej. R2)
  gallery?: string[];
  // Opcional: destacado para el panel de ofertas
  featured?: boolean;
  // Opcional: agotado (no se puede comprar)
  soldOut?: boolean;
  // Opcional: datos para cotizar envío
  shipping?: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    weightKg: number;
  };
};

export function getProducts(): Product[] {
  return productsJson as Product[];
}

export function getProductBySlug(slug: string): Product | undefined {
  return getProducts().find((p) => p.slug === slug);
}

export function formatPriceCLP(price: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(price);
}

