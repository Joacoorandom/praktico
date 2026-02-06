"use client";

import { useState, useCallback } from "react";
import { ProductImage } from "@/components/ProductImage";

type ProductGalleryProps = {
  /** Imagen principal */
  mainImage: string;
  /** Galería adicional (puede ser vacía). En la UI se muestra imagen principal + galería. */
  gallery: string[];
  name: string;
};

export function ProductGallery({ mainImage, gallery, name }: ProductGalleryProps) {
  const allImages = [mainImage, ...gallery.filter((s) => s && s !== mainImage)];
  const [index, setIndex] = useState(0);
  const current = allImages[index] ?? mainImage;

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? allImages.length - 1 : i - 1));
  }, [allImages.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i >= allImages.length - 1 ? 0 : i + 1));
  }, [allImages.length]);

  if (allImages.length === 0) return null;

  return (
    <div className="product-gallery">
      <div className="product-gallery-main">
        <ProductImage
          key={current}
          className="img product-gallery-img"
          src={current}
          alt={`${name} - foto ${index + 1}`}
          width={900}
          height={600}
          priority
        />
        {allImages.length > 1 && (
          <>
            <button
              type="button"
              className="product-gallery-arrow product-gallery-prev"
              onClick={goPrev}
              aria-label="Foto anterior"
            >
              <ArrowLeft />
            </button>
            <button
              type="button"
              className="product-gallery-arrow product-gallery-next"
              onClick={goNext}
              aria-label="Siguiente foto"
            >
              <ArrowRight />
            </button>
            <div className="product-gallery-dots" aria-hidden>
              {allImages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`product-gallery-dot ${i === index ? "is-active" : ""}`}
                  onClick={() => setIndex(i)}
                  aria-label={`Ir a foto ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ArrowLeft() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
