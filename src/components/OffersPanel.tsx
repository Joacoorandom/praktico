"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProductImage } from "@/components/ProductImage";
import { formatPriceCLP, type Product } from "@/lib/products";

export function OffersPanel({ products }: { products: Product[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const featured = products.filter((p) => p.featured).slice(0, 6);
  const fallback = featured.length === 0 ? products.slice(0, 3) : featured;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry?.isIntersecting ?? false);
      },
      { rootMargin: "0px 0px -40px 0px", threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (fallback.length === 0) return null;

  return (
    <div
      ref={ref}
      className={`offers-panel ${visible ? "is-visible" : ""}`}
      aria-label="Ofertas destacadas"
    >
      <div className="offers-panel-inner">
        <div className="offers-panel-header">
          <span className="offers-panel-badge">Ofertas</span>
          <h2 className="offers-panel-title">Destacados</h2>
          <p className="offers-panel-desc">Productos seleccionados para ti</p>
        </div>
        <div className="offers-panel-grid">
          {fallback.map((p) => (
            <Link
              key={p.id}
              href={`/productos/${p.slug}`}
              className="offers-panel-card"
              aria-label={`Ver ${p.name}`}
            >
              <div className="offers-panel-card-img">
                <ProductImage
                  className="img"
                  src={p.image}
                  alt={p.name}
                  width={280}
                  height={280}
                />
              </div>
              <div className="offers-panel-card-body">
                <span className="offers-panel-card-name">{p.name}</span>
                <span className="offers-panel-card-price">{formatPriceCLP(p.price)}</span>
                <span className="offers-panel-card-cta">Ver producto →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
