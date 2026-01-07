import brandsJson from "@/data/brands.json";
import categoriesJson from "@/data/categories.json";

export type Brand = { id: string; slug: string; name: string };
export type Category = { id: string; slug: string; name: string };

export function getBrands(): Brand[] {
  return brandsJson as Brand[];
}

export function getCategories(): Category[] {
  return categoriesJson as Category[];
}

export function getBrandName(slug?: string): string | null {
  if (!slug) return null;
  return getBrands().find((b) => b.slug === slug)?.name ?? null;
}

export function getCategoryNames(slugs?: string[]): string[] {
  if (!Array.isArray(slugs) || slugs.length === 0) return [];
  const cats = getCategories();
  const map = new Map(cats.map((c) => [c.slug, c.name]));
  return slugs.map((s) => map.get(s) || s);
}

