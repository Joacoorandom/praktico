import type { Product } from "@/lib/products";

export type CartItem = {
  product: Product;
  quantity: number;
};

const STORAGE_KEY = "praktico_store_cart_v1";

function safeParseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Validación liviana: solo aseguramos estructura básica.
    return parsed
      .filter((i) => i && typeof i === "object")
      .map((i: any) => ({
        product: i.product,
        quantity: typeof i.quantity === "number" && i.quantity > 0 ? i.quantity : 1
      }))
      .filter((i) => i.product && typeof i.product?.id === "string");
  } catch {
    return [];
  }
}

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  return safeParseCart(window.localStorage.getItem(STORAGE_KEY));
}

export function setCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addToCart(product: Product, quantity = 1): CartItem[] {
  if (product.soldOut) return getCart();
  const cart = getCart();
  const idx = cart.findIndex((i) => i.product.id === product.id);
  const next = [...cart];

  if (idx >= 0) {
    next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
  } else {
    next.push({ product, quantity });
  }

  setCart(next);
  return next;
}

export function removeFromCart(productId: string): CartItem[] {
  const next = getCart().filter((i) => i.product.id !== productId);
  setCart(next);
  return next;
}

export function updateQuantity(productId: string, quantity: number): CartItem[] {
  const q = Math.max(1, Math.floor(quantity || 1));
  const next = getCart().map((i) => (i.product.id === productId ? { ...i, quantity: q } : i));
  setCart(next);
  return next;
}

export function clearCart(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

