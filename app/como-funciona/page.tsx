import Link from "next/link";
import { storeConfig } from "@/config/store";

export const metadata = {
  title: "Cómo funciona",
  description: `Cómo comprar en ${storeConfig.storeName}. Solo aceptamos transferencia bancaria.`,
};

export default function ComoFuncionaPage() {
  return (
    <div className="content-page">
      <article className="content-page__card">
        <Link className="muted" href="/">
          ← Volver al catálogo
        </Link>
        <h1 style={{ marginTop: 12, marginBottom: 8 }}>Cómo funciona</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Así puedes comprar en {storeConfig.storeName}. Solo aceptamos pago por transferencia bancaria.
        </p>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 12 }}>1. Elige lo que quieras</h2>
          <p className="muted" style={{ margin: 0 }}>
            Recorre el <Link href="/">catálogo</Link>, entra al detalle de cada producto y agrega al carrito lo que quieras comprar. Puedes sumar cantidad y revisar el carrito cuando quieras.
          </p>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 12 }}>2. Completa tus datos</h2>
          <p className="muted" style={{ margin: 0 }}>
            En el carrito vas a cargar nombre, teléfono y correo (obligatorios). Solo usamos transferencia bancaria: no aceptamos efectivo ni otros medios. Te vamos a dar los datos de la cuenta para que transfieras el total del pedido.
          </p>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 12 }}>3. Transferencia bancaria</h2>
          <p className="muted" style={{ margin: 0 }}>
            Una vez enviados tus datos, en la pantalla te mostramos el total a pagar y los datos de la cuenta (banco, número de cuenta, RUT, titular). Debes hacer la transferencia por ese monto. En el asunto o comentario de la transferencia conviene que indiques tu nombre y teléfono.
          </p>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 12 }}>4. Confirmación por WhatsApp</h2>
          <p className="muted" style={{ margin: 0 }}>
            Después de enviar tus datos, la misma página te da un botón para abrir WhatsApp con un mensaje ya armado (tu pedido, productos y total). Envía ese mensaje para que podamos confirmar que recibimos la transferencia y coordinar la entrega o el envío del producto digital.
          </p>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 12 }}>Resumen</h2>
          <ul className="muted" style={{ margin: 0, paddingLeft: 20 }}>
            <li>Compra desde el catálogo y el carrito.</li>
            <li>Datos obligatorios: nombre, teléfono y email.</li>
            <li><strong>Pago únicamente por transferencia bancaria.</strong></li>
            <li>Te mostramos los datos de la cuenta para transferir.</li>
            <li>Confirmas por WhatsApp con el mensaje que te damos.</li>
          </ul>
        </section>

        <div className="btn-row" style={{ marginTop: 32 }}>
          <Link className="btn btn-primary" href="/">
            Ver catálogo
          </Link>
          <Link className="btn" href="/checkout">
            Ir al carrito
          </Link>
        </div>
      </article>
    </div>
  );
}
