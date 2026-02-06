import { storeConfig } from "@/config/store";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="muted">
          © {new Date().getFullYear()} {storeConfig.storeName}.
        </div>
        <div className="muted">Hecho por Praktico Shop</div>
      </div>
    </footer>
  );
}

