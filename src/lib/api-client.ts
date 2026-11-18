"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly contentType: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Lê a resposta como texto, valida o conteúdo e interpreta JSON com segurança.
 * Evita `Unexpected token '<', "<!DOCTYPE ..." is not valid JSON` quando o
 * servidor devolve uma página de erro 404/500/HTML de login em vez da API.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new ApiError("Sem conexão com o servidor. Verifique sua internet e tente novamente.", 0, "");
  }

  const contentType = response.headers.get("content-type") ?? "";
  let body = "";
  try {
    body = await response.text();
  } catch {
    throw new ApiError("Não foi possível ler a resposta do servidor.", response.status, contentType);
  }

  let parsed: unknown = null;
  if (body.trim()) {
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = null;
    }
  }

  const serverMessage =
    parsed && typeof parsed === "object" && "error" in parsed
      ? String((parsed as { error?: unknown }).error ?? "")
      : "";

  if (!response.ok) {
    if (serverMessage) throw new ApiError(serverMessage, response.status, contentType);
    if (contentType.includes("text/html") || /^\s*<!doctype|^\s*<html/i.test(body)) {
      throw new ApiError(
        `O servidor devolveu uma página HTML (HTTP ${response.status}) em vez dos dados da API. ` +
          "Geralmente isso indica deploy incompleto, rota ausente ou banco não configurado. " +
          "Publique esta versão novamente, execute o SQL do Neon e confira /api/health.",
        response.status,
        contentType,
      );
    }
    throw new ApiError(
      `O servidor respondeu HTTP ${response.status} com conteúdo inesperado. Tente novamente; se persistir, abra /diagnostico.`,
      response.status,
      contentType,
    );
  }

  if (parsed === null) {
    if (contentType.includes("text/html") || /^\s*<!doctype|^\s*<html/i.test(body)) {
      throw new ApiError(
        "A API devolveu uma página HTML em vez de JSON. Verifique se a versão publicada está atualizada e se /api/health responde ok.",
        response.status,
        contentType,
      );
    }
    throw new ApiError("Resposta inválida do servidor (não é JSON). Tente novamente.", response.status, contentType);
  }

  return parsed as T;
}
