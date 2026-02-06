"use client";

import { useRouter } from "next/navigation";
import { addToCart } from "@/lib/cart";
import type { Product } from "@/lib/products";

export function BuyButton({ product }: { product: Product }) {
  const router = useRouter();

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

