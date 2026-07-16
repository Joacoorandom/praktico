import Link from "next/link";
import { storeConfig } from "@/config/store";
import { formatPriceCLP } from "@/lib/products";

export function DonationBanner() {
  if (!storeConfig.donations.enabled) return null;

  const gifts = storeConfig.donations.gifts;

  return (
    <section className="donation-banner" aria-label="Donaciones PixelPlay">
      <div className="donation-banner-inner">
        <div className="donation-banner-copy">
          <span className="donation-banner-badge">PixelPlay</span>
          <h2>{storeConfig.donations.title}</h2>
          <p>{storeConfig.donations.subtitle}</p>
          <ul className="donation-banner-gifts">
            {gifts.map((g) => (
              <li key={g.id}>
                <strong>{g.label}</strong> desde {formatPriceCLP(g.minAmount)}
              </li>
            ))}
          </ul>
          <Link className="btn btn-primary" href="/donar">
            Donar y elegir regalo →
          </Link>
        </div>
      </div>
    </section>
  );
}
