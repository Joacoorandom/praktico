import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { storeConfig } from "@/config/store";

export const metadata: Metadata = {
  title: {
    default: storeConfig.storeName,
    template: `%s · ${storeConfig.storeName}`
  },
  description: storeConfig.storeTagline
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Header />
        <main className="container">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

