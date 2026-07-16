"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { storeConfig } from "@/config/store";
import logoNegro from "../../Praktico-logo-negro.png";

const NAV = [
  { href: "/", label: "Catálogo" },
  { href: "/donar", label: "Donar" },
  { href: "/como-funciona", label: "Cómo funciona" },
  { href: "/checkout", label: "Carrito" },
];

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <header className={`header ${isHome ? "header--home" : ""}`}>
      <div className="container header-inner">
        <Link className="brand" href="/" aria-label={storeConfig.storeName}>
          <Image className="brand-logo" src={logoNegro} alt="Praktico" priority />
        </Link>

        <nav className="nav nav--desktop" aria-label="Navegación principal">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className={pathname === href ? "is-active" : ""}>
              {label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="nav-toggle"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {menuOpen && (
        <div className="nav-overlay" aria-hidden onClick={() => setMenuOpen(false)} />
      )}

      <nav
        className={`nav nav--mobile ${menuOpen ? "is-open" : ""}`}
        aria-label="Menú móvil"
        aria-hidden={!menuOpen}
      >
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={pathname === href ? "is-active" : ""}
            onClick={() => setMenuOpen(false)}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
