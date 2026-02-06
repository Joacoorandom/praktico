import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function requireApiKey(req: Request): boolean {
  const key = process.env.ORDER_API_KEY;
  if (!key) return true;
  return req.headers.get("x-api-key") === key;
}

function parseLimit(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 5;
  return Math.min(20, Math.max(1, Math.floor(n)));
}

export async function GET(req: Request) {
  if (!requireApiKey(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const status = url.searchParams.get("status");
  const compact = url.searchParams.get("compact") === "1";

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Supabase no configurado." },
      { status: 500 }
    );
  }

  let query = supabase
    .from("orders")
    .select("id,status,created_at,payload")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: "No se pudieron leer pedidos." }, { status: 500 });
  }

  const orders = (data || []).map((row: any) => {
    const payload = row.payload || {};
    if (compact) {
      return {
        id: row.id,
        name: payload.customer?.name || "",
        phone: payload.customer?.phone || "",
        items: (payload.items || []).map((i: any) => ({
          name: i.name,
          qty: i.quantity
        })),
        total: payload.total || 0,
        status: row.status,
        createdAtISO: payload.createdAtISO || row.created_at
      };
    }

    return {
      id: row.id,
      status: row.status,
      createdAtISO: row.created_at,
      payload
    };
  });

  return NextResponse.json({ ok: true, orders });
}
