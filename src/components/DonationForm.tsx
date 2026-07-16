"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { storeConfig } from "@/config/store";
import { formatPriceCLP } from "@/lib/products";

type Gift = (typeof storeConfig.donations.gifts)[number];

type SubmitState = "idle" | "sending" | "done" | "error";

export function DonationForm() {
  const gifts = storeConfig.donations.gifts;
  const [giftId, setGiftId] = useState<string>(gifts[0]?.id ?? "apoyo");
  const gift = useMemo(
    () => gifts.find((g) => g.id === giftId) ?? gifts[0],
    [giftId, gifts]
  ) as Gift;

  const [amount, setAmount] = useState(String(gift?.minAmount ?? 1000));
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    amount: number;
    gift: Gift;
  } | null>(null);

  const amountNum = Number(amount.replace(/\D/g, "")) || 0;
  const canSubmit =
    !!gift &&
    amountNum >= gift.minAmount &&
    name.trim().length > 1 &&
    contact.trim().length > 2 &&
    state !== "sending";

  function selectGift(g: Gift) {
    setGiftId(g.id);
    const current = Number(amount.replace(/\D/g, "")) || 0;
    if (current < g.minAmount) setAmount(String(g.minAmount));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!gift || !canSubmit) return;
    setState("sending");
    setError("");
    try {
      const resp = await fetch("/api/donation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          giftId: gift.id,
          amount: amountNum,
          name: name.trim(),
          contact: contact.trim(),
          notes: notes.trim(),
          createdAtISO: new Date().toISOString(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "No se pudo registrar la donación.");
      }
      setResult({ amount: amountNum, gift });
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Error de red");
    }
  }

  const bt = storeConfig.bankTransfer;
  const whatsappText = encodeURIComponent(
    `Hola! Acabo de donar ${formatPriceCLP(result?.amount ?? amountNum)} para PixelPlay (${result?.gift.label ?? gift.label}). Te mando el comprobante.`
  );
  const whatsappHref = `https://wa.me/${storeConfig.whatsappPhoneE164}?text=${whatsappText}`;

  if (state === "done" && result) {
    return (
      <div className="donation-success">
        <div className="donation-success-icon">✓</div>
        <h2>¡Gracias por apoyar!</h2>
        <p className="muted">
          Registramos tu donación de <strong>{formatPriceCLP(result.amount)}</strong> (
          {result.gift.label}). Transferí ese monto y mandanos el comprobante.
        </p>

        <div className="panel donation-bank">
          <h3>Datos de transferencia</h3>
          <div className="donation-bank-grid">
            <div>
              <span className="muted">Banco</span>
              <strong>{bt.bankName}</strong>
            </div>
            <div>
              <span className="muted">Tipo</span>
              <strong>{bt.accountType}</strong>
            </div>
            <div>
              <span className="muted">N° cuenta</span>
              <strong>{bt.accountNumber}</strong>
            </div>
            <div>
              <span className="muted">RUT</span>
              <strong>{bt.rut}</strong>
            </div>
            <div>
              <span className="muted">Titular</span>
              <strong>{bt.accountHolder}</strong>
            </div>
            <div>
              <span className="muted">Email</span>
              <strong>{bt.email}</strong>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
            {bt.note} Monto exacto: <strong>{formatPriceCLP(result.amount)}</strong>
          </p>
        </div>

        <div className="donation-reward-box">
          <strong>Tu regalo:</strong> {result.gift.reward}
        </div>

        <div className="btn-row" style={{ justifyContent: "center" }}>
          <a className="btn btn-primary" href={whatsappHref} target="_blank" rel="noopener noreferrer">
            Enviar comprobante por WhatsApp →
          </a>
          <Link className="btn" href="/">
            Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="donation-form" onSubmit={submit}>
      <div className="donation-gifts">
        {gifts.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`donation-gift ${giftId === g.id ? "is-selected" : ""}`}
            onClick={() => selectGift(g)}
          >
            <span className="donation-gift-label">{g.label}</span>
            <span className="donation-gift-min">desde {formatPriceCLP(g.minAmount)}</span>
            <span className="donation-gift-reward">{g.reward}</span>
          </button>
        ))}
      </div>

      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="form-group">
          <label>Monto a donar (CLP) *</label>
          <input
            type="number"
            min={gift.minAmount}
            step={500}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(gift.minAmount)}
            required
          />
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            Mínimo para {gift.label}: {formatPriceCLP(gift.minAmount)}
          </span>
        </div>
        <div className="form-group">
          <label>Tu nombre *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Joaco"
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label>Contacto (Discord / WhatsApp / email) *</label>
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Ej: joaco#1234 o +56 9 …"
          required
        />
      </div>

      <div className="form-group">
        <label>Notas (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Mensaje o usuario de Minecraft…"
          rows={3}
        />
      </div>

      {error && (
        <div className="status error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button type="submit" className="btn btn-primary btn-lg" disabled={!canSubmit}>
        {state === "sending" ? "Enviando…" : `Donar ${formatPriceCLP(amountNum || gift.minAmount)} →`}
      </button>
      <p className="muted" style={{ marginTop: 12, fontSize: "0.85rem", textAlign: "center" }}>
        Al continuar te mostramos los datos de transferencia. No se cobra online.
      </p>
    </form>
  );
}
