"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "praktico-catalog-seen";

type Props = {
  updatedAt: string;
  message?: string;
};

export function CatalogBanner({ updatedAt, message = "¡NUEVOS LANZAMIENTOS!" }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      if (!lastSeen || new Date(updatedAt) > new Date(lastSeen)) {
        setShow(true);
      }
    } catch {
      setShow(false);
    }
  }, [updatedAt]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, updatedAt);
      setShow(false);
    } catch {}
  };

  if (!show) return null;

  return (
    <div
      role="alert"
      className="catalog-banner"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        background: "var(--accent)",
        color: "#fff",
        padding: "12px 20px",
        textAlign: "center",
        fontWeight: 700,
        fontSize: "0.95rem",
        boxShadow: "0 2px 8px rgba(0,0,0,.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        flexWrap: "wrap",
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar"
        style={{
          background: "rgba(255,255,255,.2)",
          border: "none",
          color: "#fff",
          padding: "6px 12px",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "13px",
        }}
      >
        Entendido
      </button>
    </div>
  );
}
