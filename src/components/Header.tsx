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
    <header className={`header ${isHome ? "header--home" : ""}`}>
      <div className="container header-inner">
        <Link className="brand" href="/" aria-label={storeConfig.storeName}>
          <Image className="brand-logo" src={logoNegro} alt="Praktico" priority />
        </Link>
        
        <nav className="nav" aria-label="Navegación principal">
          <Link href="/" className={pathname === "/" ? "is-active" : ""}>
            Catálogo
          </Link>
          <Link href="/como-funciona" className={pathname === "/como-funciona" ? "is-active" : ""}>
            Cómo funciona
          </Link>
          <Link href="/checkout" className={pathname === "/checkout" ? "is-active" : ""}>
            Carrito
          </Link>
        </nav>
      </div>
    </header>
  );
}
