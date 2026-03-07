import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyButton } from "@/components/BuyButton";
import { ProductGallery } from "@/components/ProductGallery";
import { formatPriceCLP, getProductBySlug, getProducts } from "@/lib/products";
import { getBrandName, getCategoryNames } from "@/lib/taxonomy";
import { storeConfig } from "@/config/store";

export function generateStaticParams() {
  return getProducts().map((p) => ({ slug: p.slug }));
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://praktico.vercel.app";

function absoluteImageUrl(src: string): string {
  if (src.startsWith("http")) return src;
  return `${siteUrl}${src.startsWith("/") ? src : `/${src}`}`;
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const p = getProductBySlug(params.slug);
  if (!p) return {};
  const title = `${p.name} · ${storeConfig.storeName}`;
  const description = p.description || `${p.name} - ${formatPriceCLP(p.price)}`;
  const imageUrl = absoluteImageUrl(p.image);
  return {
    title: p.name,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: p.name }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const p = getProductBySlug(params.slug);
  if (!p) notFound();

  const gallery = p.gallery && p.gallery.length > 0 ? p.gallery : [];
  const allImages = [p.image, ...gallery.filter((s) => s && s !== p.image)];

  return (
    <div className="product-page">
      <div className="product-container">
        {/* Breadcrumb */}
        <nav className="product-breadcrumb">
          <Link href="/">Catálogo</Link>
          <span>/</span>
          <span>{p.name}</span>
        </nav>

        {/* Imagen principal */}
        <div className="product-main-image">
          <ProductGallery 
            mainImage={p.image} 
            gallery={gallery} 
            name={p.name} 
          />
        </div>

        {/* Info del producto */}
        <div className="product-info">
          <div className="product-meta">
            {[getBrandName(p.brand), ...getCategoryNames(p.categories)]
              .filter(Boolean)
              .map((tag, i) => (
                <span key={i} className="product-tag">{tag}</span>
              ))}
          </div>

          <h1 className="product-name">{p.name}</h1>
          <div className="product-price">{formatPriceCLP(p.price)}</div>

          <p className="product-description">{p.description}</p>

          <div className="product-actions">
            <BuyButton product={p} />
          </div>

          {/* Info de envío - solo para productos físicos */}
          {!p.virtual && (
            <div className="product-shipping-info">
              <div className="shipping-info-row">
                <span className="shipping-icon">🚚</span>
                <div>
                  <strong>Envío rápido</strong>
                  <span className="muted">1-3 días hábiles</span>
                </div>
              </div>
              <div className="shipping-info-row">
                <span className="shipping-icon">📍</span>
                <div>
                  <strong>Retiro disponible</strong>
                  <span className="muted">Instituto de Humanidades Luis Campino</span>
                </div>
              </div>
            </div>
          )}
          {p.virtual && (
            <div className="product-shipping-info">
              <div className="shipping-info-row">
                <span className="shipping-icon">📧</span>
                <div>
                  <strong>Entrega digital</strong>
                  <span className="muted">Recibirás el producto por email después de confirmar el pago</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Galería adicional */}
        {allImages.length > 1 && (
          <div className="product-gallery-section">
            <h3 className="section-label">Galería</h3>
            <div className="product-thumbs">
              {allImages.map((src, idx) => (
                <div key={idx} className="product-thumb">
                  <img src={src} alt={`${p.name} ${idx + 1}`} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
