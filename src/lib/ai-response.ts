import type { AiAnalysisEvent, AiAnalysisPhase } from "./ai-stream";
import type { AiExtractionResult } from "./types";

const INVALID_RESPONSE =
  "A resposta da análise foi interrompida ou veio em um formato inválido. Seus arquivos continuam selecionados; tente novamente.";

function isExtractionResult(value: unknown): value is AiExtractionResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AiExtractionResult>;
  return (
    (candidate.mode === "ia" || candidate.mode === "local") &&
    typeof candidate.provider === "string" &&
    Array.isArray(candidate.warnings) &&
    Boolean(candidate.draft) &&
    Array.isArray(candidate.draft?.suppliers) &&
    Array.isArray(candidate.draft?.items)
  );
}

function errorForResponse(status: number, raw: string, json: unknown): string {
  if (status === 413 || /FUNCTION_PAYLOAD_TOO_LARGE|payload too large|entity too large/i.test(raw)) {
    return "O envio ultrapassou o limite da hospedagem. Na Vercel, o total dos arquivos deve ficar abaixo de 4 MB.";
  }
  if (status === 408 || status === 504 || /FUNCTION_INVOCATION_TIMEOUT|timed?\s*out/i.test(raw)) {
    return "A hospedagem encerrou a conexão antes de concluir a análise. Seus arquivos continuam selecionados; tente novamente e, se persistir, confira os logs da hospedagem.";
  }
  if (status === 401 || status === 403) {
    return "O acesso ao aplicativo foi recusado. Entre novamente e confira a proteção da hospedagem.";
  }
  if (json && typeof json === "object" && "error" in json && typeof json.error === "string") {
    return json.error;
  }
  return `Não foi possível analisar os documentos${status ? ` (erro ${status})` : ""}. Seus arquivos continuam selecionados; tente novamente.`;
}

/** Lê o corpo apenas uma vez, inclusive quando a hospedagem responde com HTML. */
export async function readAiAnalysisResponse(
  response: Response,
  onPhase?: (phase: AiAnalysisPhase) => void,
): Promise<AiExtractionResult> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!response.ok || !contentType.includes("application/x-ndjson")) {
    const raw = await response.text();
    let parsed: unknown = null;
    if (contentType.includes("json")) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Uma plataforma intermediária pode devolver texto ou HTML em vez de JSON.
      }
    }
    if (!response.ok) throw new Error(errorForResponse(response.status, raw, parsed));
    if (isExtractionResult(parsed)) return parsed;
    if (parsed && typeof parsed === "object" && "error" in parsed && typeof parsed.error === "string") {
      throw new Error(parsed.error);
    }
    throw new Error(INVALID_RESPONSE);
  }

  if (!response.body) throw new Error(INVALID_RESPONSE);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let result: AiExtractionResult | null = null;

  function handleLine(line: string) {
    if (!line.trim()) return;
    let event: AiAnalysisEvent;
    try {
      event = JSON.parse(line) as AiAnalysisEvent;
    } catch {
      throw new Error(INVALID_RESPONSE);
    }
    if (!event || typeof event !== "object") throw new Error(INVALID_RESPONSE);
    if (event.type === "progress" && ["recebido", "analisando", "tentando_novamente", "alternativa", "pesquisando"].includes(event.phase)) {
      onPhase?.(event.phase);
    } else if (event.type === "error") {
      throw new Error(typeof event.error === "string" ? event.error : INVALID_RESPONSE);
    } else if (event.type === "result") {
      if (!isExtractionResult(event.result)) throw new Error(INVALID_RESPONSE);
      result = event.result;
    }
  }

  try {
    for (;;) {
      const chunk = await reader.read();
      pending += decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) handleLine(line);
      if (pending.length > 5_000_000) throw new Error(INVALID_RESPONSE);
      if (chunk.done) break;
    }
    if (pending.trim()) handleLine(pending);
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }

  if (!result) throw new Error(INVALID_RESPONSE);
  return result;
}
