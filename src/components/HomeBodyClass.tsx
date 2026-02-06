"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * En home añade a body la clase is-home para que el main no tenga padding-top
 * y el hero negro colinde con el header (0px de separación).
 */
export function HomeBodyClass() {
  const pathname = usePathname();

  useEffect(() => {
    const isHome = pathname === "/";
    if (isHome) {
      document.body.classList.add("is-home");
    } else {
      document.body.classList.remove("is-home");
    }
    return () => document.body.classList.remove("is-home");
  }, [pathname]);

  return null;
}
