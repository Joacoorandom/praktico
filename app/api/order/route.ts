import { NextResponse } from "next/server";
import { storeConfig } from "@/config/store";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type OrderPayload = {
  items: OrderItem[];
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
  };
  delivery: {
    method: "retiro_colegio" | "envio_starken";
    destinationComuna?: string;
    shippingCost?: number; // CLP
    etaDays?: number | null;
    starken?: {
      nombre?: string;
      tipoEntrega?: string;
      tipoServicio?: string;
    };
  };
  payment: {
    method: "transferencia" | "efectivo";
    cash?: {
      institution: string;
      course: string;
    };
  };
  total: number;
  createdAtISO: string;
};

function formatPriceCLP(price: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(price);
}

function validate(payload: OrderPayload): { ok: true } | { ok: false; error: string } {
  if (!payload || typeof payload !== "object") return { ok: false, error: "Payload inválido." };
  if (!Array.isArray(payload.items) || payload.items.length === 0) return { ok: false, error: "Carrito vacío." };
  if (payload.items.length > 50) return { ok: false, error: "Demasiados productos." };

  if (!payload.customer || typeof payload.customer !== "object") return { ok: false, error: "Faltan datos del cliente." };
  if (!String(payload.customer.name || "").trim()) return { ok: false, error: "Nombre obligatorio." };
  if (!String(payload.customer.phone || "").trim()) return { ok: false, error: "Teléfono obligatorio." };

  if (!payload.payment || typeof payload.payment !== "object") return { ok: false, error: "Falta método de pago." };
  if (payload.payment.method !== "transferencia" && payload.payment.method !== "efectivo") {
    return { ok: false, error: "Método de pago inválido." };
  }

  if (!payload.delivery || typeof payload.delivery !== "object") return { ok: false, error: "Falta método de entrega." };
  if (payload.delivery.method !== "retiro_colegio" && payload.delivery.method !== "envio_starken") {
    return { ok: false, error: "Método de entrega inválido." };
  }

  const itemsTotal = payload.items.reduce((acc, i) => acc + Number(i.price) * Number(i.quantity), 0);
  if (!Number.isFinite(itemsTotal) || itemsTotal <= 0) return { ok: false, error: "Total inválido." };

  const shippingCost = payload.delivery.method === "envio_starken" ? Number(payload.delivery.shippingCost) : 0;
  if (payload.delivery.method === "envio_starken") {
    if (!payload.delivery.destinationComuna || !String(payload.delivery.destinationComuna).trim()) {
      return { ok: false, error: "Falta comuna de destino para envío." };
    }
    if (!Number.isFinite(shippingCost) || shippingCost <= 0) {
      return { ok: false, error: "Costo de envío inválido." };
    }
  }

  const computedTotal = itemsTotal + (Number.isFinite(shippingCost) ? shippingCost : 0);
  if (Math.abs(computedTotal - payload.total) > 0.0001) return { ok: false, error: "Total no coincide." };

  if (payload.payment.method === "efectivo") {
    const inst = payload.payment.cash?.institution || "";
    const course = payload.payment.cash?.course || "";
    if (!storeConfig.cashPayment.enabled) return { ok: false, error: "Pago en efectivo no habilitado." };
    if (!storeConfig.cashPayment.allowedInstitutions.includes(inst as any)) {
      return { ok: false, error: "Pago en efectivo no válido para esa institución." };
    }
    if (!String(course).trim()) return { ok: false, error: "Curso obligatorio para pago en efectivo." };
    if (payload.delivery.method !== "retiro_colegio") {
      return { ok: false, error: "Pago en efectivo requiere retiro en colegio." };
    }
  }

  return { ok: true };
}

function buildDiscordMessage(payload: OrderPayload): string {
  const lines: string[] = [];

  lines.push(`Nuevo pedido · ${storeConfig.storeName}`);
  lines.push(`Fecha: ${payload.createdAtISO}`);
  lines.push("");

  lines.push("Cliente:");
  lines.push(`- Nombre: ${payload.customer.name}`);
  lines.push(`- Teléfono: ${payload.customer.phone}`);
  if (payload.customer.email) lines.push(`- Email: ${payload.customer.email}`);
  if (payload.customer.address) lines.push(`- Dirección: ${payload.customer.address}`);
  if (payload.customer.notes) lines.push(`- Comentarios: ${payload.customer.notes}`);
  lines.push("");

  lines.push("Productos:");
  for (const i of payload.items) {
    lines.push(`- ${i.name} x${i.quantity} = ${formatPriceCLP(i.price * i.quantity)}`);
  }
  lines.push("");
  if (payload.delivery.method === "envio_starken") {
    lines.push("Entrega:");
    lines.push(`- Método: envío (Starken)`);
    lines.push(`- Comuna destino: ${payload.delivery.destinationComuna || ""}`);
    if (payload.delivery.etaDays) lines.push(`- Estimación: ${payload.delivery.etaDays} día(s)`);
    if (payload.delivery.starken?.nombre) lines.push(`- Opción: ${payload.delivery.starken.nombre}`);
    lines.push(`- Envío: ${formatPriceCLP(Number(payload.delivery.shippingCost) || 0)}`);
    lines.push("");
  } else {
    lines.push("Entrega:");
    lines.push("- Método: retiro en colegio");
    lines.push("");
  }
  lines.push(`Total: ${formatPriceCLP(payload.total)}`);
  lines.push("");

  lines.push(`Pago: ${payload.payment.method}`);
  if (payload.payment.method === "efectivo") {
    lines.push(`- Institución: ${payload.payment.cash?.institution || ""}`);
    lines.push(`- Curso: ${payload.payment.cash?.course || ""}`);
  }

  return lines.join("\n");
}

export async function POST(req: Request) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { ok: false, error: "Falta configurar DISCORD_WEBHOOK_URL en el servidor." },
      { status: 500 }
    );
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Supabase no configurado." },
      { status: 500 }
    );
  }

  let payload: OrderPayload;
  try {
    payload = (await req.json()) as OrderPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const v = validate(payload);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

  const { data: createdOrder, error: createError } = await supabase
    .from("orders")
    .insert({
      status: "pending",
      payload
    })
    .select("id")
    .single();

  if (createError) {
    return NextResponse.json(
      { ok: false, error: "No se pudo guardar el pedido." },
      { status: 500 }
    );
  }

  const content = [
    `ID: ${createdOrder.id}`,
    "",
    buildDiscordMessage(payload)
  ].join("\n");

  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `\`\`\`\n${content}\n\`\`\``,
      allowed_mentions: { parse: [] }
    })
  });

  if (!resp.ok) {
    return NextResponse.json(
      { ok: false, error: "No se pudo enviar el pedido a Discord.", stored: true, id: createdOrder.id },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, id: createdOrder.id });
}

