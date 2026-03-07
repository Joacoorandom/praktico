"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { storeConfig } from "@/config/store";
import { clearCart, getCart, removeFromCart, updateQuantity, type CartItem } from "@/lib/cart";
import { formatPriceCLP } from "@/lib/products";

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

type PaymentMethod = "transferencia" | "efectivo";
type DeliveryMethod = "retiro_colegio" | "envio_chileexpress";
type OrderType = "virtual" | "physical";
type FulfillmentType = "send" | "receive";

function calcTotal(items: CartItem[]) {
  return items.reduce((acc, i) => acc + i.product.price * i.quantity, 0);
}

function calcPackage(items: CartItem[]) {
  let lengthCm = 10, widthCm = 10, heightCm = 10, weightKg = 0, hasAny = false;
  for (const i of items) {
    const s = i.product.shipping;
    if (!s) { weightKg += 0.3 * i.quantity; hasAny = true; continue; }
    lengthCm = Math.max(lengthCm, Number(s.lengthCm) || 0);
    widthCm = Math.max(widthCm, Number(s.widthCm) || 0);
    heightCm = Math.max(heightCm, Number(s.heightCm) || 0);
    weightKg += (Number(s.weightKg) || 0) * i.quantity;
    hasAny = true;
  }
  return {
    lengthCm: Math.max(1, Math.round(lengthCm)),
    widthCm: Math.max(1, Math.round(widthCm)),
    heightCm: Math.max(1, Math.round(heightCm)),
    weightKg: Math.max(0.1, Math.round(weightKg * 100) / 100),
    hasAny
  };
}

function buildWhatsappMessage(params: {
  items: CartItem[];
  itemsTotal: number;
  shippingCost: number;
  orderTotal: number;
  customer: CustomerForm;
  payment: { method: PaymentMethod };
  delivery: {
    method: DeliveryMethod;
    destinationComuna?: string;
    etaDays?: number | null;
    quoteName?: string;
    retiroCourse?: string;
  };
  orderType: OrderType;
  fulfillment: FulfillmentType;
}) {
  const lines: string[] = [];
  lines.push(`Pedido ${storeConfig.storeName}`);
  lines.push("");
  lines.push(params.orderType === "virtual" ? "Tipo: Virtual/Digital" : "Tipo: Físico");
  if (params.orderType === "virtual") {
    lines.push(params.fulfillment === "send" ? "Entrega: Se envía por correo/link" : "Entrega: Se coordinará");
  }
  lines.push("");
  lines.push("Cliente:");
  lines.push(`- ${params.customer.name}`);
  lines.push(`- ${params.customer.phone}`);
  if (params.customer.email) lines.push(`- ${params.customer.email}`);
  lines.push("");
  lines.push("Productos:");
  params.items.forEach(i => {
    lines.push(`- ${i.product.name} x${i.quantity} = ${formatPriceCLP(i.product.price * i.quantity)}`);
  });
  lines.push("");
  lines.push(`Subtotal: ${formatPriceCLP(params.itemsTotal)}`);
  if (params.orderType === "physical" && params.delivery.method === "envio_chileexpress") {
    lines.push(`Envío: ${formatPriceCLP(params.shippingCost)}`);
    if (params.delivery.destinationComuna) lines.push(`Destino: ${params.delivery.destinationComuna}`);
  }
  lines.push(`Total: ${formatPriceCLP(params.orderTotal)}`);
  lines.push("");
  lines.push("Pago: Transferencia bancaria");
  lines.push("");
  lines.push("¿Confirmas el pedido?");
  return lines.join("\n");
}

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [step, setStep] = useState<"datos" | "pago" | "enviado">("datos");
  const [form, setForm] = useState<CustomerForm>({ name: "", phone: "", email: "", address: "", notes: "" });
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("retiro_colegio");
  const [retiroCourse, setRetiroCourse] = useState("");
  const [destinationComuna, setDestinationComuna] = useState("");
  const [shippingState, setShippingState] = useState<string>("idle");
  const [shippingError, setShippingError] = useState("");
  const [shippingOptions, setShippingOptions] = useState<Array<any>>([]);
  const [selectedShippingId, setSelectedShippingId] = useState<number | null>(null);
  const [submitState, setSubmitState] = useState<string>("idle");
  const [submitError, setSubmitError] = useState<string>("");
  const [lastSubmittedOrder, setLastSubmittedOrder] = useState<any>(null);

  useEffect(() => { setItems(getCart()); }, []);

  const itemsTotal = useMemo(() => calcTotal(items), [items]);
  const pkg = useMemo(() => calcPackage(items), [items]);
  const isVirtualOrder = useMemo(() => items.length > 0 && items.every(i => i.product.virtual === true), [items]);
  const orderType: OrderType = isVirtualOrder ? "virtual" : "physical";
  const fulfillment: FulfillmentType = "send";

  const selectedShipping = useMemo(() => {
    if (deliveryMethod !== "envio_chileexpress") return null;
    if (!selectedShippingId) return null;
    return shippingOptions.find(o => o.idTarifa === selectedShippingId) || null;
  }, [deliveryMethod, selectedShippingId, shippingOptions]);

  const shippingCost = useMemo(() => {
    if (orderType === "virtual") return 0;
    if (deliveryMethod !== "envio_chileexpress") return 0;
    return Number(selectedShipping?.tarifa) || 0;
  }, [orderType, deliveryMethod, selectedShipping]);

  const orderTotal = useMemo(() => itemsTotal + shippingCost, [itemsTotal, shippingCost]);

  const canContinue = items.length > 0 && form.name.trim().length > 0 && form.phone.trim().length > 0 && form.email.trim().length > 0 && submitState !== "sending";
  const retiroCourseOk = deliveryMethod !== "retiro_colegio" || retiroCourse.trim().length > 0;
  const deliveryOk = orderType === "virtual" || deliveryMethod === "retiro_colegio" || (deliveryMethod === "envio_chileexpress" && destinationComuna.trim().length > 0 && shippingState === "ready" && !!selectedShippingId);
  const canSubmit = step === "pago" && items.length > 0 && form.name.trim().length > 0 && form.phone.trim().length > 0 && form.email.trim().length > 0 && retiroCourseOk && deliveryOk && submitState !== "sending";
  const canSubmitVirtual = step === "datos" && isVirtualOrder && items.length > 0 && form.name.trim().length > 0 && form.phone.trim().length > 0 && form.email.trim().length > 0 && submitState !== "sending";

  const whatsappHref = useMemo(() => {
    const data = lastSubmittedOrder ?? {
      items, itemsTotal, shippingCost, orderTotal, customer: form,
      payment: { method: "transferencia" },
      delivery: { method: deliveryMethod, destinationComuna, etaDays: selectedShipping?.diasEntrega ?? null, quoteName: selectedShipping?.nombre, retiroCourse: deliveryMethod === "retiro_colegio" ? retiroCourse : undefined },
      orderType, fulfillment
    };
    const msg = buildWhatsappMessage(data);
    return `https://wa.me/${storeConfig.whatsappPhoneE164}?text=${encodeURIComponent(msg)}`;
  }, [lastSubmittedOrder, items, itemsTotal, shippingCost, orderTotal, form, deliveryMethod, destinationComuna, selectedShipping, retiroCourse, orderType, fulfillment]);

  async function quoteShipping() {
    setShippingState("quoting");
    setShippingError("");
    try {
      const resp = await fetch("/api/shipping/chileexpress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originComuna: storeConfig.shipping.originComuna,
          destinationComuna,
          package: { lengthCm: pkg.lengthCm, widthCm: pkg.widthCm, heightCm: pkg.heightCm, weightKg: pkg.weightKg },
          declaredValueCLP: itemsTotal
        })
      });
      const data = await resp.json() as any;
      if (!resp.ok || !data.ok) throw new Error(data.error || "No se pudo cotizar.");
      setShippingOptions(Array.isArray(data.options) ? data.options : []);
      if (data.recommended?.idTarifa) setSelectedShippingId(data.recommended.idTarifa);
      setShippingState("ready");
    } catch (e: any) {
      setShippingState("error");
      setShippingError(e?.message || "Error al cotizar.");
    }
  }

  async function submitOrderVirtual() {
    setSubmitState("sending");
    setSubmitError("");
    try {
      const payload = {
        items: items.map(i => ({ id: i.product.id, name: i.product.name, price: i.product.price, quantity: i.quantity })),
        customer: form,
        orderType: "virtual" as OrderType,
        fulfillment: "send" as FulfillmentType,
        delivery: { method: "retiro_colegio" as DeliveryMethod },
        payment: { method: "transferencia" as PaymentMethod },
        total: itemsTotal,
        createdAtISO: new Date().toISOString()
      };
      const resp = await fetch("/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await resp.json() as { ok: boolean; error?: string };
      if (!resp.ok || !data.ok) throw new Error(data.error || "No se pudo enviar.");
      setSubmitState("success");
      setLastSubmittedOrder({ items, itemsTotal, shippingCost: 0, orderTotal: itemsTotal, customer: form, payment: { method: "transferencia" }, delivery: { method: "retiro_colegio" }, orderType: "virtual", fulfillment: "send" });
      clearCart();
      setItems([]);
      setStep("enviado");
    } catch (e: any) {
      setSubmitState("error");
      setSubmitError(e?.message || "Error al enviar.");
    }
  }

  async function submitOrder() {
    setSubmitState("sending");
    setSubmitError("");
    try {
      const payload = {
        items: items.map(i => ({ id: i.product.id, name: i.product.name, price: i.product.price, quantity: i.quantity })),
        customer: form,
        orderType,
        fulfillment,
        delivery: {
          method: deliveryMethod,
          destinationComuna: deliveryMethod === "envio_chileexpress" ? destinationComuna : undefined,
          retiroCourse: deliveryMethod === "retiro_colegio" ? retiroCourse : undefined,
          shippingCost: deliveryMethod === "envio_chileexpress" ? shippingCost : undefined,
          etaDays: deliveryMethod === "envio_chileexpress" ? selectedShipping?.diasEntrega ?? null : null,
          chileexpress: deliveryMethod === "envio_chileexpress" ? { nombre: selectedShipping?.nombre, tipoEntrega: selectedShipping?.tipoEntrega, tipoServicio: selectedShipping?.tipoServicio } : undefined
        },
        payment: { method: "transferencia" as PaymentMethod },
        total: orderTotal,
        createdAtISO: new Date().toISOString()
      };
      const resp = await fetch("/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await resp.json() as { ok: boolean; error?: string };
      if (!resp.ok || !data.ok) throw new Error(data.error || "No se pudo enviar.");
      setSubmitState("success");
      setLastSubmittedOrder({ items, itemsTotal, shippingCost, orderTotal, customer: form, payment: { method: "transferencia" }, delivery: { method: deliveryMethod, destinationComuna, etaDays: selectedShipping?.diasEntrega ?? null, quoteName: selectedShipping?.nombre, retiroCourse: deliveryMethod === "retiro_colegio" ? retiroCourse : undefined }, orderType, fulfillment });
      clearCart();
      setItems([]);
      setStep("enviado");
    } catch (e: any) {
      setSubmitState("error");
      setSubmitError(e?.message || "Error al enviar.");
    }
  }

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <Link href="/" className="back-link">← Volver al catálogo</Link>
        <h1 className="checkout-title">Tu pedido</h1>
        <p className="checkout-subtitle">Solo aceptamos pago por transferencia bancaria</p>

        {items.length === 0 ? (
          <div className="panel text-center" style={{ padding: "48px 24px" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 8 }}>Tu carrito está vacío</div>
            <p className="muted" style={{ marginBottom: 24 }}>Agrega productos desde el catálogo</p>
            <Link className="btn btn-primary" href="/">Ver catálogo</Link>
          </div>
        ) : (
          <>
            {/* Resumen de productos */}
            <div className="checkout-section">
              <h2 className="section-label">Productos ({items.length})</h2>
              <div className="checkout-items">
                {items.map(i => (
                  <div key={i.product.id} className="checkout-item">
                    <Image src={i.product.image} alt={i.product.name} width={80} height={80} style={{ borderRadius: 12, objectFit: "cover" }} />
                    <div className="checkout-item-info">
                      <div className="checkout-item-name">{i.product.name}</div>
                      <div className="checkout-item-price">{formatPriceCLP(i.product.price)} c/u</div>
                    </div>
                    <div className="checkout-item-actions">
                      <input
                        type="number"
                        min={1}
                        value={i.quantity}
                        onChange={e => setItems(updateQuantity(i.product.id, Number(e.target.value)))}
                        className="qty-input"
                      />
                      <button type="button" className="btn btn-sm" onClick={() => setItems(removeFromCart(i.product.id))}>Quitar</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="checkout-total-row">
                <span>Subtotal</span>
                <span className="price">{formatPriceCLP(itemsTotal)}</span>
              </div>
            </div>

            {/* Paso 1: Datos */}
            {step === "datos" && (
              <div className="checkout-section">
                <h2 className="section-label">Tus datos</h2>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Nombre completo *</label>
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: María González" />
                  </div>
                  <div className="form-group">
                    <label>Teléfono *</label>
                    <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Ej: +56 9 1234 5678" />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="tu@email.com" />
                  </div>
                  <div className="form-group">
                    <label>Dirección (opcional)</label>
                    <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Para envíos" />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>Notas (opcional)</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Alguna indicación especial..." rows={3} />
                </div>

                {isVirtualOrder ? (
                  <button type="button" className={`btn btn-primary btn-lg ${canSubmitVirtual ? "" : "disabled"}`} onClick={submitOrderVirtual} disabled={!canSubmitVirtual || submitState === "sending"} style={{ marginTop: 24, width: "100%" }}>
                    {submitState === "sending" ? "Enviando..." : "Enviar pedido →"}
                  </button>
                ) : (
                  <button type="button" className={`btn btn-primary btn-lg ${canContinue ? "" : "disabled"}`} onClick={() => canContinue && setStep("pago")} style={{ marginTop: 24, width: "100%" }}>
                    Continuar →
                  </button>
                )}
              </div>
            )}

            {/* Paso 2: Pago y envío (solo físicos) */}
            {step === "pago" && !isVirtualOrder && (
              <div className="checkout-section">
                <h2 className="section-label">Entrega</h2>
                <div className="delivery-options">
                  <label className={`delivery-option ${deliveryMethod === "retiro_colegio" ? "is-selected" : ""}`}>
                    <input type="radio" name="delivery" checked={deliveryMethod === "retiro_colegio"} onChange={() => setDeliveryMethod("retiro_colegio")} />
                    <div className="delivery-option-content">
                      <strong>Retiro en colegio</strong>
                      <span className="muted">Instituto de Humanidades Luis Campino</span>
                    </div>
                  </label>
                  <label className={`delivery-option ${deliveryMethod === "envio_chileexpress" ? "is-selected" : ""}`}>
                    <input type="radio" name="delivery" checked={deliveryMethod === "envio_chileexpress"} onChange={() => setDeliveryMethod("envio_chileexpress")} />
                    <div className="delivery-option-content">
                      <strong>Envío a domicilio</strong>
                      <span className="muted">Por ChileExpress</span>
                    </div>
                  </label>
                </div>

                {deliveryMethod === "retiro_colegio" && (
                  <div className="form-group" style={{ marginTop: 16 }}>
                    <label>Curso *</label>
                    <input value={retiroCourse} onChange={e => setRetiroCourse(e.target.value)} placeholder="Ej: 3° Medio A" />
                  </div>
                )}

                {deliveryMethod === "envio_chileexpress" && (
                  <div style={{ marginTop: 16 }}>
                    <div className="form-group">
                      <label>Comuna de destino *</label>
                      <input value={destinationComuna} onChange={e => setDestinationComuna(e.target.value)} placeholder="Ej: Providencia" />
                    </div>
                    <button type="button" className={`btn ${destinationComuna.trim() ? "" : "disabled"}`} onClick={quoteShipping} disabled={!destinationComuna.trim() || shippingState === "quoting"} style={{ marginTop: 12 }}>
                      {shippingState === "quoting" ? "Cotizando..." : "Cotizar envío"}
                    </button>
                    {shippingState === "error" && <p className="muted" style={{ marginTop: 8, color: "#dc2626" }}>{shippingError}</p>}
                    {shippingState === "ready" && shippingOptions.length > 0 && (
                      <div className="shipping-options" style={{ marginTop: 16 }}>
                        {shippingOptions.map(o => (
                          <label key={o.idTarifa} className={`shipping-option ${selectedShippingId === o.idTarifa ? "is-selected" : ""}`}>
                            <input type="radio" name="shipping" checked={selectedShippingId === o.idTarifa} onChange={() => setSelectedShippingId(o.idTarifa)} />
                            <div className="shipping-option-content">
                              <span>{o.nombre}</span>
                              <span className="price">{formatPriceCLP(o.tarifa)}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <h2 className="section-label" style={{ marginTop: 32 }}>Pago</h2>
                <div className="panel" style={{ background: "var(--surface-2)" }}>
                  <p style={{ margin: "0 0 12px", fontWeight: 600 }}>Transferencia bancaria</p>
                  <div className="bank-details">
                    <div><span>Banco:</span> {storeConfig.bankTransfer.bankName}</div>
                    <div><span>Cuenta:</span> {storeConfig.bankTransfer.accountType} {storeConfig.bankTransfer.accountNumber}</div>
                    <div><span>RUT:</span> {storeConfig.bankTransfer.rut}</div>
                    <div><span>Titular:</span> {storeConfig.bankTransfer.accountHolder}</div>
                  </div>
                </div>

                <div className="checkout-total-row" style={{ marginTop: 24, paddingTop: 16, borderTop: "2px solid var(--border)" }}>
                  <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>Total a pagar</span>
                  <span className="price" style={{ fontSize: "1.5rem" }}>{formatPriceCLP(orderTotal)}</span>
                </div>

                <div className="btn-row" style={{ marginTop: 24 }}>
                  <button type="button" className="btn" onClick={() => setStep("datos")}>← Volver</button>
                  <button type="button" className={`btn btn-primary btn-lg ${canSubmit ? "" : "disabled"}`} onClick={submitOrder} disabled={!canSubmit || submitState === "sending"}>
                    {submitState === "sending" ? "Enviando..." : "Confirmar pedido →"}
                  </button>
                </div>
              </div>
            )}

            {/* Paso 3: Confirmación */}
            {step === "enviado" && (
              <div className="checkout-section text-center" style={{ padding: "48px 24px" }}>
                <div style={{ fontSize: "2rem", marginBottom: 16 }}>✓</div>
                <h2 style={{ margin: "0 0 8px" }}>Pedido enviado</h2>
                <p className="muted" style={{ marginBottom: 32, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
                  Realiza la transferencia y envíanos el comprobante por WhatsApp para confirmar.
                </p>
                <a className="btn btn-primary btn-lg" href={whatsappHref} target="_blank" rel="noopener noreferrer" style={{ marginBottom: 16 }}>
                  Enviar comprobante por WhatsApp
                </a>
                <div>
                  <Link className="btn" href="/">← Volver al catálogo</Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
