import { NextResponse } from "next/server";

export const runtime = "nodejs";

function requireApiKey(req: Request): boolean {
  const key = process.env.ORDER_API_KEY;
  if (!key) return true;
  return req.headers.get("x-api-key") === key;
}

/** Los pedidos ya no se guardan en base de datos; solo se envían a Discord. */
export async function GET(req: Request) {
  if (!requireApiKey(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    orders: [],
    message: "Los pedidos se envían solo a Discord. No hay listado en base de datos."
  });
}
