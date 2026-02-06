import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyButton } from "@/components/BuyButton";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductImage } from "@/components/ProductImage";
import { formatPriceCLP, getProductBySlug, getProducts } from "@/lib/products";
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

  return (
    <div className="product">
      <div className="card product-gallery-card">
        <ProductGallery mainImage={p.image} gallery={gallery} name={p.name} />
      </div>

      <div className="card product-card">
        <Link className="muted" href="/">
          ← Volver al catálogo
        </Link>
        <h1 style={{ marginTop: 10 }}>{p.name}</h1>
        <div className="price" style={{ fontSize: 22 }}>
          {formatPriceCLP(p.price)}
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          {p.description}
        </p>

        <div className="btn-row">
          <BuyButton product={p} />
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Tiempo estimado de envío</div>
          <div className="eta">
            <div className="eta-row">
              <span className="eta-label">Preparación</span>
              <span className="eta-bar" aria-hidden="true" />
              <span className="eta-value">0–1 día</span>
            </div>
            <div className="eta-row">
              <span className="eta-label">Envío</span>
              <span className="eta-bar" aria-hidden="true" />
              <span className="eta-value">1–3 días</span>
            </div>
            <div className="eta-note muted">Varía según comuna y disponibilidad.</div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Más fotos</div>
          <div className="thumb-grid" aria-label="Galería del producto">
            {(p.gallery && p.gallery.length > 0 ? p.gallery : [p.image, p.image, p.image]).map((src, idx) => (
              <div key={`${src}-${idx}`} className="thumb">
                <ProductImage className="img" src={src} alt={`${p.name} foto ${idx + 1}`} width={900} height={600} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

