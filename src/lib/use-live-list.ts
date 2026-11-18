"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/api-client";

/**
 * Mantém uma lista (clientes, catálogo) atualizada sem recarregar a página.
 * Atualiza ao voltar para a aba, ao ganhar foco e a cada minuto. O estado do
 * formulário não é alterado: só a lista de opções é reconstruída.
 */
export function useLiveList<T>(url: string, pick: (json: unknown) => T[], initial: T[]) {
  const [items, setItems] = useState<T[]>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [failed, setFailed] = useState(false);
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const data = await fetchJson<unknown>(url);
      setItems(pickRef.current(data));
      setUpdatedAt(new Date());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [url]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, 60_000);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return { items, refresh, refreshing, updatedAt, failed };
}
