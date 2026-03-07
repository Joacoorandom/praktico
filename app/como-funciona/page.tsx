import Link from "next/link";
import { storeConfig } from "@/config/store";

export const metadata = {
  title: "Cómo funciona",
  description: `Cómo comprar en ${storeConfig.storeName}. Solo aceptamos transferencia bancaria.`,
};

export default function ComoFuncionaPage() {
  const steps = [
    {
      number: "01",
      title: "Elige tus productos",
      description: "Explora nuestro catálogo y agrega al carrito todo lo que quieras. Puedes filtrar por marcas y categorías para encontrar exactamente lo que buscas."
    },
    {
      number: "02",
      title: "Completa tus datos",
      description: "En el checkout ingresa tu nombre, teléfono y email (todos obligatorios). Si tu compra incluye productos físicos, selecciona retiro en colegio o envío a domicilio."
    },
    {
      number: "03",
      title: "Realiza la transferencia",
      description: "Te mostraremos los datos de nuestra cuenta bancaria (Banco de Chile). Transfiere el total exacto del pedido. En el asunto indica tu nombre y teléfono."
    },
    {
      number: "04",
      title: "Confirma por WhatsApp",
      description: "Después de enviar tu pedido, recibirás un botón para abrir WhatsApp con todos los detalles. Envíanos el comprobante de transferencia y coordinamos la entrega."
    }
  ];

  return (
    <div className="content-page">
      <div className="content-page__header">
        <Link href="/" className="back-link">← Volver al catálogo</Link>
        <h1>Cómo funciona</h1>
        <p className="muted">Comprar en {storeConfig.storeName} es simple. Solo aceptamos transferencia bancaria.</p>
      </div>

      <div className="steps">
        {steps.map((step, i) => (
          <div key={i} className="step">
            <div className="step-number">{step.number}</div>
            <div className="step-content">
              <h3>{step.title}</h3>
              <p className="muted">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="panel info-panel" style={{ marginTop: 48 }}>
        <h4 style={{ margin: "0 0 16px" }}>Resumen</h4>
        <ul className="feature-list">
          <li>Pago únicamente por transferencia bancaria</li>
          <li>Datos obligatorios: nombre, teléfono y email</li>
          <li>Productos virtuales: entrega digital inmediata tras confirmar</li>
          <li>Productos físicos: retiro en IHLC o envío por ChileExpress</li>
          <li>Confirmación siempre por WhatsApp</li>
        </ul>
      </div>

      <div className="text-center" style={{ marginTop: 48 }}>
        <Link className="btn btn-primary btn-lg" href="/">Explorar catálogo →</Link>
      </div>
    </div>
  );
}
