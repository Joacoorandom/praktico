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
/** Tipo de compra: objeto virtual (digital) o físico (se envía/retira). */
type OrderType = "virtual" | "physical";
/** Si se envía al cliente o se recibe para responder luego. */
type FulfillmentType = "send" | "receive";

function calcTotal(items: CartItem[]) {
  return items.reduce((acc, i) => acc + i.product.price * i.quantity, 0);
}

function calcPackage(items: CartItem[]) {
  // Agregación simple (suficiente para tienda chica):
  // - Peso: suma de pesos por cantidad
  // - Dimensiones: máximo por eje (si cambias la lógica de embalaje, ajusta aquí)
  let lengthCm = 10;
  let widthCm = 10;
  let heightCm = 10;
  let weightKg = 0;
  let hasAny = false;

  for (const i of items) {
    const s = i.product.shipping;
    if (!s) {
      // Fallback si falta shipping en el JSON
      weightKg += 0.3 * i.quantity;
      hasAny = true;
      continue;
    }
    lengthCm = Math.max(lengthCm, Number(s.lengthCm) || 0);
    widthCm = Math.max(widthCm, Number(s.widthCm) || 0);
    heightCm = Math.max(heightCm, Number(s.heightCm) || 0);
    weightKg += (Number(s.weightKg) || 0) * i.quantity;
    hasAny = true;
  }

  // Evitar ceros
  return {
    lengthCm: Math.max(1, Math.round(lengthCm)),
    widthCm: Math.max(1, Math.round(widthCm)),
    heightCm: Math.max(1, Math.round(heightCm)),
    weightKg: Math.max(0.1, Math.round(weightKg * 100) / 100),
    hasAny
  };
}

function buildWhatsappConfirmMessage(params: {
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
  lines.push("Hola, quería saber detalles de mi pedido.");
  lines.push("");
  lines.push(`--- Pedido ${storeConfig.storeName} ---`);
  lines.push("");
  lines.push("Tipo de compra:");
  lines.push(params.orderType === "virtual" ? "- Objeto virtual (digital)" : "- Objeto físico");
  if (params.orderType === "virtual") {
    lines.push(
      params.fulfillment === "send"
        ? "- Se envía: te lo enviaremos por correo/link."
        : "- Se recibe: te responderemos luego para coordinar."
    );
  }
  lines.push("");
  lines.push("Cliente:");
  lines.push(`- Nombre: ${params.customer.name}`);
  lines.push(`- Teléfono: ${params.customer.phone}`);
  if (params.customer.email) lines.push(`- Email: ${params.customer.email}`);
  if (params.customer.address) lines.push(`- Dirección: ${params.customer.address}`);
  if (params.customer.notes) lines.push(`- Comentarios: ${params.customer.notes}`);
  lines.push("");
  lines.push("Productos:");
  for (const i of params.items) {
    const subtotal = i.product.price * i.quantity;
    lines.push(
      `- ${i.product.name} x${i.quantity} · ${formatPriceCLP(i.product.price)} c/u · Subtotal ${formatPriceCLP(subtotal)}`
    );
  }
  lines.push("");
  lines.push(`Subtotal productos: ${formatPriceCLP(params.itemsTotal)}`);
  if (params.orderType === "physical" && params.delivery.method === "envio_chileexpress") {
    lines.push("Entrega: envío (ChileExpress)");
    if (params.delivery.destinationComuna) lines.push(`- Comuna destino: ${params.delivery.destinationComuna}`);
    if (params.delivery.quoteName) lines.push(`- Opción: ${params.delivery.quoteName}`);
    if (params.delivery.etaDays) lines.push(`- Estimación: ${params.delivery.etaDays} día(s)`);
    lines.push(`Envío: ${formatPriceCLP(params.shippingCost)}`);
  } else if (params.orderType === "physical") {
    lines.push("Entrega: retiro en colegio");
    if (params.delivery.retiroCourse) lines.push(`- Curso: ${params.delivery.retiroCourse}`);
  }
  lines.push(`Total: ${formatPriceCLP(params.orderTotal)}`);
  lines.push("Pago: Transferencia bancaria");
  if (params.orderType === "physical" && params.delivery.method === "retiro_colegio" && params.delivery.retiroCourse) {
    lines.push(`- Retiro en colegio, curso: ${params.delivery.retiroCourse}`);
  }
  lines.push("Transferencia: enviar comprobante por este WhatsApp una vez pagado.");
  lines.push("");
  lines.push("¿Me confirmas la recepción del pedido, por favor?");
  return lines.join("\n");
}

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [step, setStep] = useState<"datos" | "pago" | "enviado">("datos");
  const [form, setForm] = useState<CustomerForm>({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: ""
  });
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "error" | "success">("idle");
  const [submitError, setSubmitError] = useState<string>("");
  /** Snapshot del pedido recién enviado, para armar el mensaje de WhatsApp con productos y totales. */
  const [lastSubmittedOrder, setLastSubmittedOrder] = useState<{
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
  } | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("retiro_colegio");
  const [retiroCourse, setRetiroCourse] = useState("");
  const [destinationComuna, setDestinationComuna] = useState("");
  const [shippingState, setShippingState] = useState<"idle" | "quoting" | "error" | "ready">("idle");
  const [shippingError, setShippingError] = useState("");
  const [shippingOptions, setShippingOptions] = useState<
    Array<{
      idTarifa: number;
      nombre: string;
      tipoEntrega: string;
      tipoServicio: string;
      tarifa: number;
      diasEntrega: number;
    }>
  >([]);
  const [selectedShippingId, setSelectedShippingId] = useState<number | null>(null);

  useEffect(() => {
    setItems(getCart());
  }, []);

  const itemsTotal = useMemo(() => calcTotal(items), [items]);
  const pkg = useMemo(() => calcPackage(items), [items]);

  /** Pedido virtual si todos los ítems del carrito son productos virtuales. No se muestra al usuario. */
  const isVirtualOrder = useMemo(
    () => items.length > 0 && items.every((i) => (i.product as { virtual?: boolean }).virtual === true),
    [items]
  );
  const orderType: OrderType = isVirtualOrder ? "virtual" : "physical";
  const fulfillment: FulfillmentType = "send";


  const selectedShipping = useMemo(() => {
    if (deliveryMethod !== "envio_chileexpress") return null;
    if (!selectedShippingId) return null;
    return shippingOptions.find((o) => o.idTarifa === selectedShippingId) || null;
  }, [deliveryMethod, selectedShippingId, shippingOptions]);

  const shippingCost = useMemo(() => {
    if (orderType === "virtual") return 0;
    if (deliveryMethod !== "envio_chileexpress") return 0;
    return Number(selectedShipping?.tarifa) || 0;
  }, [orderType, deliveryMethod, selectedShipping]);

  const orderTotal = useMemo(() => itemsTotal + shippingCost, [itemsTotal, shippingCost]);

  const canContinue =
    items.length > 0 &&
    form.name.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.email.trim().length > 0 &&
    submitState !== "sending";

  const retiroCourseOk =
    deliveryMethod !== "retiro_colegio" || retiroCourse.trim().length > 0;

  const deliveryOk =
    orderType === "virtual" ||
    deliveryMethod === "retiro_colegio" ||
    (deliveryMethod === "envio_chileexpress" &&
      destinationComuna.trim().length > 0 &&
      shippingState === "ready" &&
      !!selectedShippingId);

  const canSubmit =
    step === "pago" &&
    items.length > 0 &&
    form.name.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.email.trim().length > 0 &&
    retiroCourseOk &&
    deliveryOk &&
    submitState !== "sending";

  const canSubmitVirtual =
    step === "datos" &&
    isVirtualOrder &&
    items.length > 0 &&
    form.name.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.email.trim().length > 0 &&
    submitState !== "sending";

  const whatsappConfirmHref = useMemo(() => {
    const data = lastSubmittedOrder ?? {
      items,
      itemsTotal,
      shippingCost,
      orderTotal,
      customer: form,
      payment: { method: "transferencia" as PaymentMethod },
      delivery: {
        method: deliveryMethod,
        destinationComuna,
        etaDays: selectedShipping?.diasEntrega ?? null,
        quoteName: selectedShipping?.nombre,
        retiroCourse: deliveryMethod === "retiro_colegio" ? retiroCourse : undefined
      },
      orderType,
      fulfillment
    };
    const msg = buildWhatsappConfirmMessage(data);
    return `https://wa.me/${storeConfig.whatsappPhoneE164}?text=${encodeURIComponent(msg)}`;
  }, [
    lastSubmittedOrder,
    items,
    itemsTotal,
    shippingCost,
    orderTotal,
    form,
    retiroCourse,
    deliveryMethod,
    destinationComuna,
    selectedShipping,
    orderType,
    fulfillment
  ]);

  async function quoteShipping() {
    setShippingState("quoting");
    setShippingError("");
    setShippingOptions([]);
    setSelectedShippingId(null);
    try {
      const resp = await fetch("/api/shipping/chileexpress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originComuna: storeConfig.shipping.originComuna,
          destinationComuna,
          package: {
            lengthCm: pkg.lengthCm,
            widthCm: pkg.widthCm,
            heightCm: pkg.heightCm,
            weightKg: pkg.weightKg
          },
          declaredValueCLP: itemsTotal
        })
      });
      const data = (await resp.json()) as any;
      if (!resp.ok || !data.ok) throw new Error(data.error || "No se pudo cotizar.");

      const options = Array.isArray(data.options) ? data.options : [];
      setShippingOptions(options);
      const rec = data.recommended;
      if (rec?.idTarifa) setSelectedShippingId(rec.idTarifa);
      setShippingState("ready");
    } catch (e: any) {
      setShippingState("error");
      setShippingError(e?.message || "Error al cotizar.");
    }
  }

  async function submitOrderVirtual() {
    setSubmitState("sending");
    setSubmitError("");
    const total = itemsTotal;
    try {
      const payload = {
        items: items.map((i) => ({
          id: i.product.id,
          name: i.product.name,
          price: i.product.price,
          quantity: i.quantity
        })),
        customer: form,
        orderType: "virtual" as OrderType,
        fulfillment: "send" as FulfillmentType,
        delivery: { method: "retiro_colegio" as DeliveryMethod },
        payment: { method: "transferencia" as PaymentMethod },
        total,
        createdAtISO: new Date().toISOString()
      };

      const resp = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = (await resp.json()) as { ok: boolean; error?: string };
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "No se pudo enviar el pedido.");
      }

      setSubmitState("success");
      setLastSubmittedOrder({
        items,
        itemsTotal,
        shippingCost: 0,
        orderTotal: total,
        customer: form,
        payment: { method: "transferencia" },
        delivery: { method: "retiro_colegio" },
        orderType: "virtual",
        fulfillment: "send"
      });
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
        items: items.map((i) => ({
          id: i.product.id,
          name: i.product.name,
          price: i.product.price,
          quantity: i.quantity
        })),
        customer: form,
        orderType,
        fulfillment,
        delivery: {
          method: deliveryMethod,
          destinationComuna: deliveryMethod === "envio_chileexpress" ? destinationComuna : undefined,
          retiroCourse: deliveryMethod === "retiro_colegio" ? retiroCourse : undefined,
          shippingCost: deliveryMethod === "envio_chileexpress" ? shippingCost : undefined,
          etaDays: deliveryMethod === "envio_chileexpress" ? selectedShipping?.diasEntrega ?? null : null,
          chileexpress:
            deliveryMethod === "envio_chileexpress"
              ? {
                  nombre: selectedShipping?.nombre,
                  tipoEntrega: selectedShipping?.tipoEntrega,
                  tipoServicio: selectedShipping?.tipoServicio
                }
              : undefined
        },
        payment: { method: "transferencia" as PaymentMethod },
        total: orderTotal,
        createdAtISO: new Date().toISOString()
      };

      const resp = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = (await resp.json()) as { ok: boolean; error?: string };
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "No se pudo enviar el pedido.");
      }

      setSubmitState("success");
      setLastSubmittedOrder({
        items,
        itemsTotal,
        shippingCost,
        orderTotal,
        customer: form,
        payment: { method: "transferencia" },
        delivery: {
          method: deliveryMethod,
          destinationComuna,
          etaDays: selectedShipping?.diasEntrega ?? null,
          quoteName: selectedShipping?.nombre,
          retiroCourse: deliveryMethod === "retiro_colegio" ? retiroCourse : undefined
        },
        orderType,
        fulfillment
      });
      clearCart();
      setItems([]);
      setStep("enviado");
    } catch (e: any) {
      setSubmitState("error");
      setSubmitError(e?.message || "Error al enviar.");
    }
  }

  return (
    <div className="product" style={{ alignItems: "start" }}>
      <div className="card product-card">
        <Link className="muted" href="/">
          ← Seguir comprando
        </Link>
        <h1 style={{ marginTop: 10 }}>Carrito / Pedido</h1>
        <p className="muted" style={{ marginTop: 6 }}>Completa tus datos. Solo aceptamos pago por transferencia bancaria.</p>

        {items.length === 0 ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 800 }}>Tu carrito está vacío</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Vuelve al catálogo para agregar productos.
            </div>
            <div className="btn-row">
              <Link className="btn btn-primary" href="/">
                Ver catálogo
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            {items.map((i) => (
              <div key={i.product.id} className="panel" style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
                <Image className="img" src={i.product.image} alt={i.product.name} width={900} height={600} />
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800 }}>{i.product.name}</div>
                    <div className="muted">{formatPriceCLP(i.product.price)}</div>
                  </div>

                  <label htmlFor={`qty-${i.product.id}`}>Cantidad</label>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      id={`qty-${i.product.id}`}
                      type="number"
                      min={1}
                      value={i.quantity}
                      onChange={(e) => {
                        const next = updateQuantity(i.product.id, Number(e.target.value));
                        setItems(next);
                      }}
                      style={{ maxWidth: 140 }}
                    />
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => {
                        const next = removeFromCart(i.product.id);
                        setItems(next);
                      }}
                    >
                      Quitar
                    </button>
                  </div>

                  <div className="price" style={{ marginTop: 10 }}>
                    Subtotal: {formatPriceCLP(i.product.price * i.quantity)}
                  </div>
                </div>
              </div>
            ))}

            <div className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Total</div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{formatPriceCLP(itemsTotal)}</div>
            </div>

            <div className="btn-row">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  clearCart();
                  setItems([]);
                }}
              >
                Vaciar carrito
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card product-card">
        {step === "datos" ? (
          <>
            <h2 style={{ margin: 0 }}>Tus datos</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              Estos datos se enviarán al negocio. Solo aceptamos transferencia bancaria; te enviaremos los datos para pagar.
            </p>

            <label htmlFor="name">Nombre *</label>
            <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

            <label htmlFor="phone">Teléfono *</label>
            <input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />

            <label htmlFor="email">Email *</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Para enviarte el comprobante y coordinar"
            />

            <label htmlFor="address">Dirección (opcional)</label>
            <input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />

            <label htmlFor="notes">Comentarios (opcional)</label>
            <textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

            {submitState === "error" ? (
              <div className="panel" style={{ marginTop: 12, borderColor: "var(--border)" }}>
                <div style={{ fontWeight: 800 }}>No se pudo enviar</div>
                <div className="muted" style={{ marginTop: 6 }}>{submitError}</div>
              </div>
            ) : null}

            <div className="btn-row" style={{ marginTop: 12 }}>
              {isVirtualOrder ? (
                <button
                  type="button"
                  className={`btn btn-primary ${canSubmitVirtual ? "" : "disabled"}`}
                  onClick={() => {
                    if (!canSubmitVirtual) return;
                    submitOrderVirtual();
                  }}
                  disabled={submitState === "sending"}
                >
                  {submitState === "sending" ? "Enviando..." : "Enviar datos"}
                </button>
              ) : (
                <button
                  type="button"
                  className={`btn btn-primary ${canContinue ? "" : "disabled"}`}
                  onClick={() => {
                    if (!canContinue) return;
                    setStep("pago");
                  }}
                >
                  Continuar
                </button>
              )}
            </div>
          </>
        ) : step === "pago" ? (
          <>
            <h2 style={{ margin: 0 }}>Pago por transferencia</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              Solo aceptamos transferencia bancaria. Si eres del IHLC puedes acordar retiro en el colegio; si no, envío por ChileExpress.
            </p>

            <div className="panel" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Datos para transferir</div>
              <div className="muted">
                <div>
                  <strong>Banco:</strong> {storeConfig.bankTransfer.bankName}
                </div>
                <div>
                  <strong>Tipo de cuenta:</strong> {storeConfig.bankTransfer.accountType}
                </div>
                <div>
                  <strong>N° de cuenta:</strong> {storeConfig.bankTransfer.accountNumber}
                </div>
                <div>
                  <strong>RUT:</strong> {storeConfig.bankTransfer.rut}
                </div>
                <div>
                  <strong>Titular:</strong> {storeConfig.bankTransfer.accountHolder}
                </div>
                <div>
                  <strong>Email:</strong> {storeConfig.bankTransfer.email}
                </div>
                <div style={{ marginTop: 8 }}>
                  <strong>Nota:</strong> {storeConfig.bankTransfer.note}
                </div>
              </div>
            </div>

            {/* Envío: solo para objeto físico */}
            {orderType === "physical" ? (
              <div className="panel" style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Envío</div>
                <div className="muted" style={{ marginBottom: 10 }}>
                  Si eres del IHLC puedes acordar el retiro dentro del recinto escolar (sin costo). Si no, elige envío a domicilio por ChileExpress.
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 8px" }}>
                  <input
                    type="radio"
                    name="deliveryTransfer"
                    checked={deliveryMethod === "retiro_colegio"}
                    onChange={() => setDeliveryMethod("retiro_colegio")}
                    style={{ width: 18, height: 18 }}
                  />
                  Retiro en colegio (Instituto de Humanidades Luis Campino)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 12px" }}>
                  <input
                    type="radio"
                    name="deliveryTransfer"
                    checked={deliveryMethod === "envio_chileexpress"}
                    onChange={() => setDeliveryMethod("envio_chileexpress")}
                    style={{ width: 18, height: 18 }}
                  />
                  Envío a domicilio (ChileExpress)
                </label>

                {deliveryMethod === "retiro_colegio" ? (
                  <>
                    <label htmlFor="retiroCourse">Curso *</label>
                    <input
                      id="retiroCourse"
                      value={retiroCourse}
                      onChange={(e) => setRetiroCourse(e.target.value)}
                      placeholder="Ej: 3° Medio A"
                    />
                  </>
                ) : null}

                {deliveryMethod === "envio_chileexpress" ? (
                  <>
                    <label htmlFor="destComuna">Comuna destino *</label>
                    <input
                      id="destComuna"
                      value={destinationComuna}
                      onChange={(e) => setDestinationComuna(e.target.value)}
                      placeholder="Ej: Santiago"
                    />
                  </>
                ) : null}

                {deliveryMethod === "envio_chileexpress" ? (
                  <>
                    <div className="muted" style={{ marginTop: 10 }}>
                      Paquete estimado: {pkg.lengthCm}×{pkg.widthCm}×{pkg.heightCm} cm · {pkg.weightKg} kg
                    </div>

                    <div className="btn-row">
                      <button
                        type="button"
                        className={`btn btn-primary ${destinationComuna.trim().length > 0 ? "" : "disabled"}`}
                        onClick={() => {
                          if (!destinationComuna.trim()) return;
                          quoteShipping();
                        }}
                        disabled={shippingState === "quoting"}
                      >
                        {shippingState === "quoting" ? "Cotizando..." : "Cotizar envío"}
                      </button>
                    </div>

                    {shippingState === "error" ? (
                      <div className="muted" style={{ marginTop: 10 }}>
                        {shippingError}
                      </div>
                    ) : null}

                    {shippingState === "ready" && shippingOptions.length > 0 ? (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontWeight: 800, marginBottom: 8 }}>Opciones</div>
                        <div style={{ display: "grid", gap: 8 }}>
                          {shippingOptions.map((o) => (
                            <label key={o.idTarifa} className="panel" style={{ margin: 0, cursor: "pointer" }}>
                              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <input
                                  type="radio"
                                  name="shippingOption"
                                  checked={selectedShippingId === o.idTarifa}
                                  onChange={() => setSelectedShippingId(o.idTarifa)}
                                  style={{ width: 18, height: 18 }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 800 }}>{o.nombre}</div>
                                  <div className="muted" style={{ marginTop: 2 }}>
                                    {o.tipoEntrega} · {o.tipoServicio} · {o.diasEntrega} día(s)
                                  </div>
                                </div>
                                <div style={{ fontWeight: 900 }}>{formatPriceCLP(o.tarifa)}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="panel" style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div className="muted">Subtotal productos</div>
                <div style={{ fontWeight: 800 }}>{formatPriceCLP(itemsTotal)}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div className="muted">Envío</div>
                <div style={{ fontWeight: 800 }}>{formatPriceCLP(shippingCost)}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 900 }}>Total</div>
                <div style={{ fontWeight: 900 }}>{formatPriceCLP(orderTotal)}</div>
              </div>
            </div>

            {submitState === "error" ? (
              <div className="panel" style={{ marginTop: 12, borderColor: "var(--border)" }}>
                <div style={{ fontWeight: 800 }}>No se pudo enviar</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  {submitError}
                </div>
              </div>
            ) : null}

            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => setStep("datos")} disabled={submitState === "sending"}>
                ← Volver
              </button>
              <button
                type="button"
                className={`btn btn-primary ${canSubmit ? "" : "disabled"}`}
                onClick={() => {
                  if (!canSubmit) return;
                  submitOrder();
                }}
              >
                {submitState === "sending" ? "Enviando..." : "Confirmar y enviar"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0 }}>Datos enviados. Ahora debes transferir</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              Recibimos tu pedido. Realiza la transferencia con los datos que te mostramos y luego envía el mensaje por WhatsApp para que podamos confirmar y coordinar la entrega.
            </p>

            <div className="panel" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Enviar mensaje por WhatsApp</div>
              <div className="muted" style={{ marginBottom: 12 }}>
                Abre el enlace y envía el mensaje con los detalles de tu pedido. Así confirmamos la transferencia y coordinamos.
              </div>
              <div className="btn-row">
                <a className="btn btn-primary" href={whatsappConfirmHref} target="_blank" rel="noopener noreferrer">
                  Abrir WhatsApp y enviar mensaje
                </a>
              </div>
            </div>

            <div className="btn-row" style={{ marginTop: 12 }}>
              <Link className="btn" href="/">
                Volver al catálogo
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

