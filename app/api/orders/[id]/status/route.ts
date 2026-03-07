import { NextResponse } from "next/server";

export const runtime = "nodejs";

function requireApiKey(req: Request): boolean {
  const key = process.env.ORDER_API_KEY;
  if (!key) return true;
  return req.headers.get("x-api-key") === key;
}

/** Los pedidos ya no se guardan en base de datos; no se puede actualizar estado. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!requireApiKey(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Los pedidos se envían solo a Discord. No hay base de datos para actualizar estado."
    },
    { status: 410 }
  );
}
