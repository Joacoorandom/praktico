"use client";

import { useRouter } from "next/navigation";
import { addToCart } from "@/lib/cart";
import type { Product } from "@/lib/products";

export function BuyButton({ product }: { product: Product }) {
  const router = useRouter();
  const soldOut = !!product.soldOut;

  if (soldOut) {
    return (
      <span className="btn btn-primary" style={{ opacity: 0.8, cursor: "default", pointerEvents: "none" }}>
        Agotado
      </span>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() => {
        addToCart(product, 1);
        router.push("/checkout");
      }}
    >
      Comprar
    </button>
  );
}

