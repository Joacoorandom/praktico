import { NextResponse } from "next/server";

export const runtime = "nodejs";

type QuoteRequest = {
  originComuna: string;
  destinationComuna: string;
  // Medidas en cm y peso en kg
  package: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    weightKg: number;
  };
  declaredValueCLP: number;
};

type Localidad = {
  CIUDCODIGO: number;
  COMUNA: string;
};

let localidadesCache: { fetchedAt: number; data: Localidad[] } | null = null;

function normalizeKey(s: string) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function getUuid(): Promise<string> {
  const resp = await fetch("https://apiprod.starkenpro.cl/quote/limitRequest/obtenerUUID/", {
    // En algunos entornos, la validación SSL puede dar problemas; Next/Vercel la maneja bien.
    method: "GET",
    headers: { Accept: "application/json" }
  });
  if (!resp.ok) throw new Error("No se pudo obtener UUID de Starken.");
  const json = (await resp.json()) as { uuid_user?: string };
  if (!json.uuid_user) throw new Error("UUID inválido desde Starken.");
  return json.uuid_user;
}

async function getLocalidades(uuid: string): Promise<Localidad[]> {
  const now = Date.now();
  if (localidadesCache && now - localidadesCache.fetchedAt < 1000 * 60 * 60 * 12) {
    return localidadesCache.data;
  }

  const resp = await fetch("https://apiprod.starkenpro.cl/agency/agencyDls/localidades", {
    method: "GET",
    headers: { Accept: "application/json", uuid }
  });
  if (!resp.ok) throw new Error("No se pudo cargar localidades de Starken.");
  const json = (await resp.json()) as { data?: Localidad[] };
  const data = Array.isArray(json.data) ? json.data : [];

  localidadesCache = { fetchedAt: now, data };
  return data;
}

function findCityCode(localidades: Localidad[], comuna: string): number | null {
  const key = normalizeKey(comuna);
  const found = localidades.find((l) => normalizeKey(l.COMUNA) === key);
  return found?.CIUDCODIGO ?? null;
}

export async function POST(req: Request) {
  let body: QuoteRequest;
  try {
    body = (await req.json()) as QuoteRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const originComuna = String(body?.originComuna || "").trim();
  const destinationComuna = String(body?.destinationComuna || "").trim();
  const declaredValueCLP = Number(body?.declaredValueCLP);
  const pkg = body?.package;

  if (!originComuna) return NextResponse.json({ ok: false, error: "Falta comuna de origen." }, { status: 400 });
  if (!destinationComuna) return NextResponse.json({ ok: false, error: "Falta comuna de destino." }, { status: 400 });
  if (!Number.isFinite(declaredValueCLP) || declaredValueCLP <= 0) {
    return NextResponse.json({ ok: false, error: "Valor declarado inválido." }, { status: 400 });
  }

  const lengthCm = Number(pkg?.lengthCm);
  const widthCm = Number(pkg?.widthCm);
  const heightCm = Number(pkg?.heightCm);
  const weightKg = Number(pkg?.weightKg);

  if (![lengthCm, widthCm, heightCm, weightKg].every((n) => Number.isFinite(n) && n > 0)) {
    return NextResponse.json({ ok: false, error: "Datos del paquete inválidos." }, { status: 400 });
  }

  try {
    const uuid = await getUuid();
    const localidades = await getLocalidades(uuid);

    const codigoCiudadOrigen = findCityCode(localidades, originComuna);
    const codigoCiudadDestino = findCityCode(localidades, destinationComuna);

    if (!codigoCiudadOrigen) {
      return NextResponse.json(
        { ok: false, error: `Comuna de origen no encontrada: "${originComuna}".` },
        { status: 400 }
      );
    }
    if (!codigoCiudadDestino) {
      return NextResponse.json(
        { ok: false, error: `Comuna de destino no encontrada: "${destinationComuna}".` },
        { status: 400 }
      );
    }

    const payload = {
      codigoCiudadOrigen,
      codigoCiudadDestino,
      encargos: [
        {
          alto: heightCm,
          largo: lengthCm,
          ancho: widthCm,
          kilos: weightKg
        }
      ],
      valorDeclarado: declaredValueCLP,
      uuid
    };

    const quoteResp = await fetch("https://apiprod.starkenpro.cl/quote/new-cotizador/multiple/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    });

    const quoteJson = (await quoteResp.json()) as any;
    if (!quoteResp.ok || quoteJson?.status !== 200) {
      return NextResponse.json({ ok: false, error: "No se pudo cotizar el envío." }, { status: 502 });
    }

    const optionsRaw = quoteJson?.data?.tarifa;
    const options = Array.isArray(optionsRaw)
      ? optionsRaw.map((o: any) => ({
          idTarifa: o.idTarifa,
          nombre: o.nombre,
          tipoEntrega: o.tipoEntrega,
          tipoServicio: o.tipoServicio,
          tipoPago: o.tipoPago,
          tarifa: o.tarifa,
          diasEntrega: o.diasEntrega,
          fechaCompromiso: o.fechaCompromiso
        }))
      : [];

    const recommended =
      options.find((o) => o.tipoEntrega === "DOMICILIO" && o.tipoServicio === "NORMAL") ||
      options.find((o) => o.tipoEntrega === "DOMICILIO") ||
      options[0] ||
      null;

    return NextResponse.json({
      ok: true,
      provider: "starken",
      originComuna,
      destinationComuna,
      options,
      recommended
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error al cotizar." }, { status: 500 });
  }
}

