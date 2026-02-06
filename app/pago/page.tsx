import Link from "next/link";
import { storeConfig } from "@/config/store";

export const metadata = {
  title: "Pago por transferencia"
};

export default function PagoPage() {
  const bt = storeConfig.bankTransfer;

  return (
    <div className="card product-card">
      <Link className="muted" href="/">
        ← Volver al catálogo
      </Link>

      <h1 style={{ marginTop: 10 }}>Pago por transferencia</h1>
      <p className="muted" style={{ marginTop: 6 }}>
        Una vez enviado el pedido, pagas por transferencia y nos mandas el comprobante por WhatsApp o correo.
      </p>

      <div className="panel" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Datos de transferencia</div>
        <div className="muted">
          <div>
            <strong>Banco:</strong> {bt.bankName}
          </div>
          <div>
            <strong>Tipo de cuenta:</strong> {bt.accountType}
          </div>
          <div>
            <strong>N° de cuenta:</strong> {bt.accountNumber}
          </div>
          <div>
            <strong>RUT:</strong> {bt.rut}
          </div>
          <div>
            <strong>Titular:</strong> {bt.accountHolder}
          </div>
          <div>
            <strong>Email:</strong> {bt.email}
          </div>
          <div style={{ marginTop: 8 }}>
            <strong>Nota:</strong> {bt.note}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Pasos</div>
        <ol className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Agrega productos al carrito y envía el pedido.</li>
          <li>Realiza la transferencia.</li>
          <li>Envía el comprobante por WhatsApp o correo.</li>
          <li>Confirmamos manualmente y coordinamos entrega/retiro.</li>
        </ol>
      </div>

      <div className="btn-row">
        <Link className="btn btn-primary" href="/checkout">
          Ir al carrito
        </Link>
      </div>
    </div>
  );
}

