"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { storeConfig } from "@/config/store";
import logoNegro from "../../Praktico-logo-negro.png";

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className={`header ${isHome ? "header--home" : "header--detail"}`}>
      <div className="container header-inner">
        <Link className="brand brand-centered" href="/" aria-label={storeConfig.storeName}>
          <Image className="brand-logo" src={logoNegro} alt="Praktico" priority />
        </Link>
        <nav className="nav nav-centered" aria-label="Navegación">
          <Link href="/">Catálogo</Link>
          <Link href="/checkout">Carrito</Link>
        </nav>
      </div>
    </header>
  );
}
