"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Atualiza os dados vindos do servidor quando a aba volta a ficar visível, para que
 * cadastros feitos em outra aba (clientes, propostas, catálogo) apareçam sem recarregar.
 * O estado dos formulários é preservado; o refresh é limitado a uma vez a cada 15 s.
 */
export function RefreshOnFocus({ minIntervalMs = 15_000 }: { minIntervalMs?: number }) {
  const router = useRouter();
  const last = useRef(0);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - last.current < minIntervalMs) return;
      last.current = now;
      router.refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, minIntervalMs]);

  return null;
}
