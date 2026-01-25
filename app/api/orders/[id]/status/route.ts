import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function requireApiKey(req: Request): boolean {
  const key = process.env.ORDER_API_KEY;
  if (!key) return true;
  return req.headers.get("x-api-key") === key;
}

const ALLOWED_STATUS = new Set(["pending", "processing", "completed", "cancelled"]);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!requireApiKey(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  if (!body.status || !ALLOWED_STATUS.has(body.status)) {
    return NextResponse.json({ ok: false, error: "Estado inválido." }, { status: 400 });
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

  const { data, error } = await supabase
    .from("orders")
    .update({ status: body.status })
    .eq("id", params.id)
    .select("id,status")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: "No se pudo actualizar el pedido." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, order: data });
}
