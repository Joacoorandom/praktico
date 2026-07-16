import { NextResponse } from "next/server";
import { storeConfig } from "@/config/store";

export const runtime = "nodejs";

type DonationPayload = {
  giftId: string;
  amount: number;
  name: string;
  contact: string;
  notes?: string;
  createdAtISO: string;
};

function formatPriceCLP(price: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(price);
}

function normalizeForBlocklist(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

const BLOCKED_TERMS = [
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "puta",
  "puto",
  "maricon",
  "marica",
  "concha",
  "weon",
  "weona",
  "hijo de puta",
  "hdp",
  "ctm",
  "culiao",
  "culia",
];

function containsBlockedContent(text: string): boolean {
  const n = normalizeForBlocklist(text);
  return BLOCKED_TERMS.some((term) => n.includes(term));
}

function validate(
  payload: DonationPayload
): { ok: true; gift: (typeof storeConfig.donations.gifts)[number] } | { ok: false; error: string } {
  if (!storeConfig.donations.enabled) {
    return { ok: false, error: "Las donaciones no están habilitadas." };
  }
  if (!payload || typeof payload !== "object") return { ok: false, error: "Payload inválido." };

  const gift = storeConfig.donations.gifts.find((g) => g.id === payload.giftId);
  if (!gift) return { ok: false, error: "Seleccioná un regalo válido." };

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount < gift.minAmount) {
    return {
      ok: false,
      error: `El monto mínimo para ${gift.label} es ${formatPriceCLP(gift.minAmount)}.`,
    };
  }
  if (amount > 5_000_000) return { ok: false, error: "Monto demasiado alto." };

  const name = String(payload.name || "").trim();
  const contact = String(payload.contact || "").trim();
  if (!name) return { ok: false, error: "Nombre obligatorio." };
  if (!contact) return { ok: false, error: "Contacto obligatorio (Discord, WhatsApp o email)." };

  for (const text of [name, contact, payload.notes || ""]) {
    if (containsBlockedContent(text)) {
      return { ok: false, error: "El mensaje contiene texto no permitido." };
    }
  }

  return { ok: true, gift };
}

function buildDiscordMessage(
  payload: DonationPayload,
  gift: (typeof storeConfig.donations.gifts)[number]
): string {
  const lines = [
    `💚 Nueva donación · PixelPlay / ${storeConfig.storeName}`,
    `Fecha: ${payload.createdAtISO}`,
    "",
    `Nivel: ${gift.label}`,
    `Regalo: ${gift.reward}`,
    `Monto: ${formatPriceCLP(payload.amount)}`,
    "",
    "Donante:",
    `- Nombre: ${payload.name}`,
    `- Contacto: ${payload.contact}`,
  ];
  if (payload.notes?.trim()) lines.push(`- Notas: ${payload.notes.trim()}`);
  lines.push("", "Esperando transferencia + comprobante.");
  return lines.join("\n");
}

export async function POST(req: Request) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: "Falta configurar DISCORD_WEBHOOK_URL (Environment Variables en Vercel).",
      },
      { status: 500 }
    );
  }

  let payload: DonationPayload;
  try {
    payload = (await req.json()) as DonationPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const v = validate(payload);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

  const content = buildDiscordMessage(payload, v.gift);
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `\`\`\`\n${content}\n\`\`\``,
      allowed_mentions: { parse: [] },
    }),
  });

  if (!resp.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo enviar la donación a Discord. Revisá DISCORD_WEBHOOK_URL en Vercel.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    bank: storeConfig.bankTransfer,
    amount: payload.amount,
    gift: v.gift,
  });
}
