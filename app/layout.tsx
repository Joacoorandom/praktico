import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HomeBodyClass } from "@/components/HomeBodyClass";
import { storeConfig } from "@/config/store";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: {
    default: storeConfig.storeName,
    template: `%s · ${storeConfig.storeName}`
  },
  description: storeConfig.storeTagline
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={dmSans.variable}>
      <body>
        <HomeBodyClass />
        <Header />
        <main className="container">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

