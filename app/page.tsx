import Link from "next/link";
import { storeConfig } from "@/config/store";
import { ProductImage } from "@/components/ProductImage";
import { ProductCardReveal } from "@/components/ProductGridReveal";
import { OffersPanel } from "@/components/OffersPanel";
import { formatPriceCLP, getProducts } from "@/lib/products";
import { getBrandName, getCategoryNames } from "@/lib/taxonomy";

export default function HomePage() {
  const products = getProducts();

  return (
    <div>
      <section className="hero">
        <div className="container">
          <h1>{storeConfig.storeName}</h1>
          <p>{storeConfig.storeTagline}</p>
        </div>
      </section>

      <div className="container">
        <OffersPanel products={products} />

        <span className="section-label">Productos</span>
        <section className="grid" aria-label="Listado de productos">
          {products.map((p, i) => (
            <ProductCardReveal key={p.id} index={i}>
              <Link href={`/productos/${p.slug}`} aria-label={`Ver ${p.name}`} className="img-wrap">
                <ProductImage className="img" src={p.image} alt={p.name} width={900} height={600} />
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
                  <Link className="btn btn-primary" href={`/productos/${p.slug}`}>
                    Comprar
                  </Link>
                </div>
              </div>
            </ProductCardReveal>
          ))}
        </section>
      </div>
    </div>
  );
}

