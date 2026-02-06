import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HomeBodyClass } from "@/components/HomeBodyClass";
import { CatalogBanner } from "@/components/CatalogBanner";
import { storeConfig } from "@/config/store";
import { getCatalogMeta } from "@/lib/catalog-meta";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://praktico.vercel.app";
const defaultOgImage = `${siteUrl}/Praktico-logo-negro.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: storeConfig.storeName,
    template: `%s · ${storeConfig.storeName}`,
  },
  description: storeConfig.storeTagline,
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: storeConfig.storeName,
    title: storeConfig.storeName,
    description: storeConfig.storeTagline,
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: storeConfig.storeName }],
  },
  twitter: {
    card: "summary_large_image",
    title: storeConfig.storeName,
    description: storeConfig.storeTagline,
    images: [defaultOgImage],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const catalogMeta = getCatalogMeta();
  return (
    <html lang="es" className={dmSans.variable}>
      <body>
        <HomeBodyClass />
        <CatalogBanner updatedAt={catalogMeta.updatedAt} message={catalogMeta.message} />
        <Header />
        <main className="container">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

