import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card product-card">
      <h1 style={{ margin: 0 }}>Página no encontrada</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        La página que buscas no existe o fue movida.
      </p>
      <div className="btn-row">
        <Link className="btn btn-primary" href="/">
          Volver al catálogo
        </Link>
      </div>
    </div>
  );
}

