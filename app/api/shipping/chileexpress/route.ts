import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CHILEXPRESS_RATING_URL =
  "https://testservices.wschilexpress.com/rating/api/v1.0/rates/courier";

type QuoteRequest = {
  originComuna: string;
  destinationComuna: string;
  package: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    weightKg: number;
  };
  declaredValueCLP: number;
};

type ShippingOption = {
  idTarifa: number;
  nombre: string;
  tipoEntrega: string;
  tipoServicio: string;
  tarifa: number;
  diasEntrega: number;
};

/** Códigos de cobertura ChileExpress por comuna (API Consultar Coberturas). Ejemplos: STGO, PROV. */
const COMUNA_TO_COVERAGE_CODE: Record<string, string> = {
  santiago: "STGO",
  providencia: "PROV",
  "las condes": "LCON",
  "la florida": "LFLD",
  "puente alto": "PALT",
  maipu: "MAIP",
  "maipú": "MAIP",
  vitacura: "VITA",
  "lo barnechea": "LBAR",
  ñuñoa: "NUNO",
  "nuñoa": "NUNO",
  "la reina": "LREI",
  macul: "MACU",
  "san miguel": "SMIG",
  "pedro aguirre cerda": "PAGU",
  independencia: "INDE",
  recoleta: "RECO",
  concón: "CONC",
  "viña del mar": "VINA",
  viña: "VINA",
  valparaiso: "VALE",
  valparaíso: "VALE",
  quilpue: "QUIL",
  "villa alemana": "VALE",
  concepcion: "CONC",
  concepción: "CONC",
  talcahuano: "TALC",
  temuco: "TEMU",
  "la serena": "SERE",
  coquimbo: "COQU",
  antofagasta: "ANTO",
  iquique: "IQUI",
  rancagua: "RANC",
  curico: "CURI",
  "curicó": "CURI",
  chillan: "CHIL",
  "chillán": "CHIL",
  osorno: "OSOR",
  "puerto montt": "PMON",
  calama: "CALA",
  copiapo: "COPI",
  "copiapó": "COPI",
};

function normalizeComuna(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getCoverageCode(comuna: string): string | null {
  const key = normalizeComuna(comuna);
  if (COMUNA_TO_COVERAGE_CODE[key]) return COMUNA_TO_COVERAGE_CODE[key];
  // Buscar por coincidencia parcial (ej. "Santiago" en "Santiago Centro")
  for (const [name, code] of Object.entries(COMUNA_TO_COVERAGE_CODE)) {
    if (key.includes(name) || name.includes(key)) return code;
  }
  // Fallback: primeras 4 letras en mayúscula (ChileExpress suele usar 4 caracteres)
  const clean = key.replace(/\s+/g, "").replace(/[^a-z]/gi, "");
  if (clean.length >= 2) return clean.slice(0, 4).toUpperCase();
  return null;
}

/** Respuesta del API Rating ChileExpress */
type ChileExpressRateOption = {
  serviceTypeCode: number;
  serviceDescription: string;
  didUseVolumetricWeight?: boolean;
  finalWeight?: string;
  serviceValue: string;
  conditions?: string;
  deliveryType?: number;
  additionalServices?: unknown[];
};

type ChileExpressRatingResponse = {
  data?: {
    courierServiceOptions?: ChileExpressRateOption[];
  };
  statusCode?: number;
  statusDescription?: string;
  errors?: string[] | null;
};

export async function POST(req: Request) {
  let body: QuoteRequest;
  try {
    body = (await req.json()) as QuoteRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const originComuna = String(body?.originComuna || "").trim();
  const destinationComuna = String(body?.destinationComuna || "").trim();
  const pkg = body?.package;
  const weightKg = Number(pkg?.weightKg) || 0.5;
  const lengthCm = Math.max(1, Math.round(Number(pkg?.lengthCm) || 10));
  const widthCm = Math.max(1, Math.round(Number(pkg?.widthCm) || 10));
  const heightCm = Math.max(1, Math.round(Number(pkg?.heightCm) || 10));
  const declaredValueCLP = Math.max(0, Math.round(Number(body?.declaredValueCLP) || 0));

  if (!originComuna)
    return NextResponse.json({ ok: false, error: "Falta comuna de origen." }, { status: 400 });
  if (!destinationComuna)
    return NextResponse.json({ ok: false, error: "Falta comuna de destino." }, { status: 400 });
  if (!(weightKg > 0))
    return NextResponse.json({ ok: false, error: "Peso del paquete inválido." }, { status: 400 });

  const apiKey = process.env.CHILEXPRESS_API_KEY;
  let options: ShippingOption[] = [];

  if (apiKey) {
    const originCode = getCoverageCode(originComuna);
    const destinationCode = getCoverageCode(destinationComuna);

    if (!originCode) {
      return NextResponse.json(
        { ok: false, error: `Comuna de origen no encontrada en cobertura: "${originComuna}".` },
        { status: 400 }
      );
    }
    if (!destinationCode) {
      return NextResponse.json(
        { ok: false, error: `Comuna de destino no encontrada en cobertura: "${destinationComuna}".` },
        { status: 400 }
      );
    }

    const requestBody = {
      originCountyCode: originCode,
      destinationCountyCode: destinationCode,
      package: {
        weight: String(weightKg.toFixed(2)),
        height: String(heightCm),
        width: String(widthCm),
        length: String(lengthCm)
      },
      productType: 3, // Encomienda
      contentType: 1,
      declaredWorth: String(declaredValueCLP),
      deliveryTime: 0 // Todos los servicios
    };

    try {
      const res = await fetch(CHILEXPRESS_RATING_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Ocp-Apim-Subscription-Key": apiKey
        },
        body: JSON.stringify(requestBody)
      });

      const json = (await res.json()) as ChileExpressRatingResponse;

      if (!res.ok) {
        const errMsg =
          json?.statusDescription || json?.errors?.join(" ") || `HTTP ${res.status}`;
        return NextResponse.json({ ok: false, error: errMsg }, { status: 502 });
      }

      if (json.statusCode !== 0 && json.statusCode !== undefined) {
        const errMsg = json.statusDescription || json?.errors?.join(" ") || "Error en respuesta.";
        return NextResponse.json({ ok: false, error: errMsg }, { status: 400 });
      }

      const courierOptions = json.data?.courierServiceOptions ?? [];
      options = courierOptions.map((opt, idx) => ({
        idTarifa: opt.serviceTypeCode ?? idx + 1,
        nombre: opt.serviceDescription || "ChileExpress",
        tipoEntrega: "Domicilio",
        tipoServicio: opt.serviceDescription || "Normal",
        tarifa: Math.round(Number(opt.serviceValue) || 0),
        diasEntrega: opt.deliveryType ?? 2
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error al llamar a ChileExpress.";
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
  }

  if (options.length === 0) {
    // Tarifa estimada cuando no hay API key o no hay resultados
    const baseCLP = 3500;
    const perKg = 800;
    const tarifa = Math.round(baseCLP + weightKg * perKg);
    const diasEntrega =
      normalizeComuna(originComuna) === normalizeComuna(destinationComuna) ? 1 : 2;
    options = [
      {
        idTarifa: 1,
        nombre: "ChileExpress estándar (estimado)",
        tipoEntrega: "Domicilio",
        tipoServicio: "Normal",
        tarifa,
        diasEntrega
      }
    ];
  }

  const recommended = options[0] ?? null;
  return NextResponse.json({
    ok: true,
    provider: "chileexpress",
    originComuna,
    destinationComuna,
    options,
    recommended
  });
}
