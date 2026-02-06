import catalogMetaJson from "@/data/catalog-meta.json";

export type CatalogMeta = {
  updatedAt: string;
  message?: string;
};

export function getCatalogMeta(): CatalogMeta {
  return catalogMetaJson as CatalogMeta;
}
