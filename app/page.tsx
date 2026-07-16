import { storeConfig } from "@/config/store";
import { OffersPanel } from "@/components/OffersPanel";
import { DonationBanner } from "@/components/DonationBanner";
import { CatalogWithFilters } from "@/components/CatalogWithFilters";
import { getProducts } from "@/lib/products";
import { getBrands, getCategories } from "@/lib/taxonomy";

export default function HomePage() {
  const products = getProducts();
  const brands = getBrands();
  const categories = getCategories();

  return (
    <div>
      <section className="hero">
        <div className="container">
          <h1>{storeConfig.storeName}</h1>
          <p>{storeConfig.storeTagline}</p>
        </div>
      </section>

      <div className="container">
        <DonationBanner />
        <OffersPanel products={products} />

        <span className="section-label">Productos</span>
        <CatalogWithFilters products={products} brands={brands} categories={categories} />
      </div>
    </div>
  );
}
