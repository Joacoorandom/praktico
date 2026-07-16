import Link from "next/link";
import { storeConfig } from "@/config/store";
import { DonationForm } from "@/components/DonationForm";

export const metadata = {
  title: "Donar · Apoyar PixelPlay",
  description: storeConfig.donations.subtitle,
};

export default function DonarPage() {
  if (!storeConfig.donations.enabled) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <p className="muted">Las donaciones no están habilitadas por ahora.</p>
        <Link href="/">← Volver</Link>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="checkout-container donation-page">
        <Link href="/" className="back-link">
          ← Volver al catálogo
        </Link>
        <h1 className="checkout-title">{storeConfig.donations.title}</h1>
        <p className="checkout-subtitle">{storeConfig.donations.subtitle}</p>
        <DonationForm />
      </div>
    </div>
  );
}
