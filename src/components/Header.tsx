import Link from "next/link";
import Image from "next/image";
import { storeConfig } from "@/config/store";
import logoNegro from "../../Praktico-logo-negro.png";
import logoBlanco from "../../Praktico-logo-blanco.png";

export function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Link className="brand brand-centered" href="/" aria-label={storeConfig.storeName}>
          <Image className="brand-logo brand-logo-dark" src={logoNegro} alt="Praktico" priority />
          <Image className="brand-logo brand-logo-light" src={logoBlanco} alt="Praktico" priority />
        </Link>
        <nav className="nav nav-centered" aria-label="Navegación">
          <Link href="/">Catálogo</Link>
          <Link href="/checkout">Carrito</Link>
          <Link href="/pago">Pago</Link>
        </nav>
      </div>
    </header>
  );
}

