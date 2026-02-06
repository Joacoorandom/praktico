"use client";

import { useEffect, useRef, useState } from "react";

const OBSERVER_OPTIONS: IntersectionObserverInit = {
  root: null,
  rootMargin: "0px 0px -60px 0px",
  threshold: 0.1
};

export function ProductGridReveal({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry?.isIntersecting ?? false);
    }, OBSERVER_OPTIONS);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${className} ${visible ? "grid-reveal is-visible" : "grid-reveal"}`}>
      {children}
    </div>
  );
}

export function ProductCardReveal({
  children,
  index
}: {
  children: React.ReactNode;
  index: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry?.isIntersecting ?? false);
    }, OBSERVER_OPTIONS);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <article
      ref={ref as React.RefObject<HTMLElement>}
      className={`card card-reveal ${visible ? "is-visible" : ""}`}
      style={{ ["--reveal-i" as string]: index }}
    >
      {children}
    </article>
  );
}
