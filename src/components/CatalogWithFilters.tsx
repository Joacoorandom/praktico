"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ProductImage } from "@/components/ProductImage";
import { ProductCardReveal } from "@/components/ProductGridReveal";
import { formatPriceCLP, type Product } from "@/lib/products";
import type { Brand, Category } from "@/lib/taxonomy";
import { getBrandName, getCategoryNames } from "@/lib/taxonomy";

type Props = {
  products: Product[];
  brands: Brand[];
  categories: Category[];
};

export function CatalogWithFilters({ products, brands, categories }: Props) {
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedBrand != null && p.brand !== selectedBrand) return false;
      if (selectedCategory != null && !(p.categories && p.categories.includes(selectedCategory)))
        return false;
      return true;
    });
  }, [products, selectedBrand, selectedCategory]);

  const categoriesForCurrentBrand = useMemo(() => {
    if (!selectedBrand) return categories;
    const slugs = new Set<string>();
    products
      .filter((p) => p.brand === selectedBrand)
      .forEach((p) => p.categories?.forEach((c) => slugs.add(c)));
    return categories.filter((c) => slugs.has(c.slug));
  }, [products, selectedBrand, categories]);

  return (
    <div className="catalog-filters">
      {(brands.length > 0 || categories.length > 0) && (
        <div className="catalog-filters__bar">
          {brands.length > 0 && (
            <div className="catalog-filters__group">
              <span className="catalog-filters__label">Marcas</span>
              <div className="catalog-filters__buttons">
                <button
                  type="button"
                  className={`catalog-filters__btn ${selectedBrand === null ? "is-active" : ""}`}
                  onClick={() => setSelectedBrand(null)}
                >
                  Todas
                </button>
                {brands.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`catalog-filters__btn ${selectedBrand === b.slug ? "is-active" : ""}`}
                    onClick={() => setSelectedBrand(b.slug)}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {categories.length > 0 && (
            <div className="catalog-filters__group">
              <span className="catalog-filters__label">
                {selectedBrand ? "Categorías (en esta marca)" : "Categorías"}
              </span>
              <div className="catalog-filters__buttons">
                <button
                  type="button"
                  className={`catalog-filters__btn ${selectedCategory === null ? "is-active" : ""}`}
                  onClick={() => setSelectedCategory(null)}
                >
                  Todas
                </button>
                {(selectedBrand ? categoriesForCurrentBrand : categories).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`catalog-filters__btn ${selectedCategory === c.slug ? "is-active" : ""}`}
                    onClick={() => setSelectedCategory(c.slug)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="catalog-filters__count">
        {filteredProducts.length === 0 ? (
          <p className="muted">No hay productos con este filtro. Prueba otra marca o categoría.</p>
        ) : (
          <span className="muted">
            {filteredProducts.length} producto{filteredProducts.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <section className="grid" aria-label="Listado de productos">
        {filteredProducts.map((p, i) => (
          <ProductCardReveal key={p.id} index={i}>
            <Link href={`/productos/${p.slug}`} aria-label={`Ver ${p.name}`} className="img-wrap">
              <ProductImage className="img" src={p.image} alt={p.name} fill />
            </Link>
            <div className="card-body">
              <h2 className="card-title">
                <Link href={`/productos/${p.slug}`}>{p.name}</Link>
              </h2>
              <div className="price">{formatPriceCLP(p.price)}</div>
              <div className="muted" style={{ marginTop: 6 }}>
                {[getBrandName(p.brand), ...getCategoryNames(p.categories)].filter(Boolean).join(" · ")}
              </div>
              <p className="muted" style={{ margin: "10px 0 0" }}>
                {p.description}
              </p>
              <div className="btn-row">
                <Link className="btn" href={`/productos/${p.slug}`}>
                  Ver detalle
                </Link>
                {p.soldOut ? (
                  <span className="btn btn-primary" style={{ opacity: 0.8, cursor: "default" }}>
                    Agotado
                  </span>
                ) : (
                  <Link className="btn btn-primary" href={`/productos/${p.slug}`}>
                    Comprar
                  </Link>
                )}
              </div>
            </div>
          </ProductCardReveal>
        ))}
      </section>
    </div>
  );
}
