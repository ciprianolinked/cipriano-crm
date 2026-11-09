const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const GEMINI_GENERATE_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// O modelo Flash-Lite possui suporte a PDFs, imagens e saída estruturada e foi
// verificado com a API nativa do Google para a leitura de cotações.
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";
// O Flash continua disponível como alternativa quando houver instabilidade.
export const FALLBACK_GEMINI_MODEL = "gemini-3.8-flash";
export const GEMINI_ANALYSIS_TIMEOUT_MS = 210_000;
// O Google pode solicitar intervalos de 30 segundos em erros 503.
// Respeitamos o cabeçalho Retry-After sem exceder o tempo total da análise.
const MAX_RETRY_AFTER_MS = 60_000;

/** Mantém configurações personalizadas, mas substitui o modelo antigo indisponível. */
export function resolveGeminiModel(configuredModel?: string): string {
  const model = (configuredModel ?? "").trim().replace(/^models\//i, "");
  if (!model || /^gemini-2\.5-flash(?:-latest|-001)?$/i.test(model)) {
    return DEFAULT_GEMINI_MODEL;
  }
  return model;
}

export type GeminiInputPart =
  | { type: "text"; text: string }
  | { type: "document" | "image"; data: string; mime_type: string };

export type GeminiRetryPhase = "retrying" | "alternative";

type InteractionResponse = {
  status?: string;
  output_text?: string;
  error?: { code?: string; message?: string };
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

type GenerateResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
  promptFeedback?: { blockReason?: string };
};

type GeminiRequest = {
  model: string;
  apiKey: string;
  input: GeminiInputPart[];
  responseSchema?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  onRetry?: (phase: GeminiRetryPhase) => void;
  preferredTransport?: "interactions" | "generateContent";
  /** Permite testes rápidos; em produção é usado o intervalo recomendado. */
  retryBaseDelayMs?: number;
};

export type GeminiInteractionResult = {
  text: string;
  model: string;
  usedAlternative: boolean;
  switchedModel: boolean;
};

type Transport = "interactions" | "generateContent";

class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly retryAfterMs: number | null,
    public readonly invalidKey: boolean,
    public readonly dailyQuota: boolean = false,
  ) {
    super(`Google Gemini retornou HTTP ${status}`);
    this.name = "GoogleApiError";
  }
}

function parseGoogleError(status: number, details: string, retryAfter: string | null): GoogleApiError {
  let code = "";
  try {
    const parsed: unknown = JSON.parse(details);
    const entry = Array.isArray(parsed) ? parsed[0] : parsed;
    if (entry && typeof entry === "object" && "error" in entry) {
      const value = (entry as { error?: { code?: unknown; status?: unknown } }).error;
      code = typeof value?.code === "string" ? value.code : typeof value?.status === "string" ? value.status : "";
    }
  } catch {
    // Algumas falhas da rede ou do Google não vêm em JSON.
  }
  let retryAfterMs: number | null = null;
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const value = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(value) && value >= 0) retryAfterMs = value;
  }
  return new GoogleApiError(
    status,
    code.toLowerCase(),
    retryAfterMs,
    /api.?key.*not valid|api_key_invalid|api key invalid/i.test(details),
    /quota_exceeded|per.?day|daily.?quota|daily.?limit|requests.?per.?day/i.test(`${code} ${details}`),
  );
}

function friendlyGeminiError(error: GoogleApiError): string {
  const { status, invalidKey } = error;
  if (status === 401 || (status === 400 && invalidKey)) {
    return "A chave do Gemini não é válida. Copie a chave completa no Google AI Studio e confira em Configurar IA.";
  }
  if (status === 402) {
    return "O Google informou que o projeto não tem créditos disponíveis. Confira o faturamento ou a cota do projeto no Google AI Studio.";
  }
  if (status === 403) {
    return "O Google recusou o acesso. Verifique se a chave está ativa, se a API Gemini está habilitada e se o projeto pode usar o modelo selecionado.";
  }
  if (status === 404 || status === 501) {
    return "O modelo Gemini configurado não está disponível para esta chave. Confira os modelos habilitados no Google AI Studio e a variável GEMINI_MODEL da hospedagem.";
  }
  if (status === 429) {
    return "O Google informou limite de uso ou falta de cota para o modelo. Seus arquivos continuam selecionados. Confira os limites no Google AI Studio e tente novamente após a renovação da cota.";
  }
  if (status === 400) {
    return "O Google não conseguiu processar esta solicitação. Confira se os PDFs e imagens estão válidos e tente novamente.";
  }
  if (status === 408 || status === 504) {
    return `O Google não concluiu a análise a tempo (código ${status}). Seus arquivos continuam selecionados. Confira o status do Gemini e tente novamente.`;
  }
  if (status >= 500) {
    return `O Google não conseguiu concluir a análise (código ${status}). Seus arquivos continuam selecionados. Verifique o status do Gemini e tente novamente.`;
  }
  return `Não foi possível concluir a solicitação ao Gemini (erro ${status}). Confira a configuração e tente novamente.`;
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isDailyQuota(error: GoogleApiError): boolean {
  return error.dailyQuota || error.code === "quota_exceeded" || /daily|per_day|perday/.test(error.code);
}

function requestFor(
  transport: Transport,
  model: string,
  input: GeminiInputPart[],
  responseSchema?: unknown,
): { url: string; body: Record<string, unknown> } {
  const useLowThinking = /^gemini-3(?:\.|-)/i.test(model);
  if (transport === "interactions") {
    const body: Record<string, unknown> = { model, input, store: false };
    if (useLowThinking) body.generation_config = { thinking_level: "low" };
    if (responseSchema) {
      body.response_format = { type: "text", mime_type: "application/json", schema: responseSchema };
    }
    return { url: GEMINI_INTERACTIONS_URL, body };
  }

  // GenerateContent é uma segunda API oficial do Google; mantém os mesmos PDFs,
  // imagem, chave e esquema. Não são feitas análises separadas nem mapas parciais.
  const parts = input.map((part) =>
    part.type === "text"
      ? { text: part.text }
      : { inlineData: { mimeType: part.mime_type, data: part.data } },
  );
  const generationConfig: Record<string, unknown> = {};
  if (useLowThinking) generationConfig.thinkingConfig = { thinkingLevel: "low" };
  if (responseSchema) {
    generationConfig.responseFormat = { text: { mimeType: "APPLICATION_JSON", schema: responseSchema } };
  }
  return {
    url: `${GEMINI_GENERATE_BASE}/${encodeURIComponent(model)}:generateContent`,
    body: { contents: [{ role: "user", parts }], generationConfig },
  };
}

function getResponseText(data: unknown, transport: Transport): string {
  if (!data || typeof data !== "object") throw new Error("O Google Gemini retornou uma resposta inválida. Tente novamente.");
  if (transport === "interactions") {
    const result = data as InteractionResponse;
    if (result.status === "failed" && result.error) {
      const code = (result.error.code ?? "").toLowerCase();
      if (/api_error|service_unavailable|deadline_exceeded/.test(code)) {
        throw new GoogleApiError(code === "deadline_exceeded" ? 504 : 503, code, null, false);
      }
      if (/rate_limit_exceeded|quota_exceeded|too_many_requests/.test(code)) {
        throw new GoogleApiError(429, code, null, false);
      }
    }
    if (result.status && result.status !== "completed") {
      throw new Error("O Google Gemini não concluiu a análise. Seus arquivos continuam selecionados; tente novamente.");
    }
    const text = result.output_text || (result.steps ?? [])
      .filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? [])
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
    if (!text?.trim()) throw new Error("O Google Gemini não retornou uma resposta de texto. Tente novamente.");
    return text;
  }

  const result = data as GenerateResponse;
  const candidate = result.candidates?.[0];
  if (result.promptFeedback?.blockReason || (candidate?.finishReason && candidate.finishReason !== "STOP")) {
    throw new Error("O Google não concluiu a leitura dos documentos. Confira se os arquivos estão acessíveis e tente novamente.");
  }
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
  if (!text.trim()) throw new Error("O Google Gemini não retornou uma resposta de texto. Tente novamente.");
  return text;
}

async function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new Error("Operação interrompida");
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Operação interrompida"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Tenta a API Interactions, repete falhas transitórias e, se necessário, usa
 * GenerateContent e um modelo compatível. A chave nunca vai ao navegador.
 */
export async function createGeminiInteractionDetailed({
  model,
  apiKey,
  input,
  responseSchema,
  timeoutMs = GEMINI_ANALYSIS_TIMEOUT_MS,
  signal,
  onRetry,
  preferredTransport,
  retryBaseDelayMs = 600,
}: GeminiRequest): Promise<GeminiInteractionResult> {
  const key = apiKey.trim();
  if (!key) throw new Error("Informe a chave do Gemini em Configurar IA.");

  const primaryModel = resolveGeminiModel(model);
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const timeoutMessage = "O Gemini não respondeu dentro do tempo disponível. Os arquivos continuam selecionados; tente novamente. Se o problema persistir, confira o status e a cota do Google AI Studio.";
  const alternativeModel = primaryModel === DEFAULT_GEMINI_MODEL
    ? FALLBACK_GEMINI_MODEL
    : primaryModel === FALLBACK_GEMINI_MODEL
      ? DEFAULT_GEMINI_MODEL
      : null;
  // Cada tentativa tem um prazo próprio. Uma conexão parada não pode consumir
  // os 210 segundos inteiros e impedir o uso de um modelo/endpoint alternativo.
  // Para PDFs e imagens, a API multimodal GenerateContent costuma responder
  // mais rapidamente; para o teste simples de chave, mantemos Interactions.
  const firstTransport: Transport = preferredTransport ?? (input.some((part) => part.type !== "text") ? "generateContent" : "interactions");
  const alternateTransport: Transport = firstTransport === "interactions" ? "generateContent" : "interactions";
  const attempts: Array<{ transport: Transport; model: string; timeoutMs: number }> =
    primaryModel === FALLBACK_GEMINI_MODEL && alternativeModel
      ? [
          { transport: firstTransport, model: primaryModel, timeoutMs: 65_000 },
          { transport: firstTransport, model: alternativeModel, timeoutMs: 45_000 },
          { transport: alternateTransport, model: alternativeModel, timeoutMs: 45_000 },
          { transport: alternateTransport, model: primaryModel, timeoutMs: 45_000 },
        ]
      : [
          { transport: firstTransport, model: primaryModel, timeoutMs: 65_000 },
          { transport: alternateTransport, model: primaryModel, timeoutMs: 45_000 },
          { transport: firstTransport, model: primaryModel, timeoutMs: 45_000 },
          ...(alternativeModel
            ? [{ transport: firstTransport, model: alternativeModel, timeoutMs: 45_000 }]
            : []),
        ];
  let index = 0;
  let previousError: GoogleApiError | null = null;

  function checkAbort() {
    if (signal?.aborted) throw new Error("Análise cancelada. Os arquivos continuam selecionados.");
    if (timeoutSignal.aborted) throw new Error(timeoutMessage);
  }

  while (index < attempts.length) {
    checkAbort();
    const attempt = attempts[index];
    const { url, body } = requestFor(attempt.transport, attempt.model, input, responseSchema);
    const attemptTimeout = AbortSignal.timeout(attempt.timeoutMs);
    const attemptSignal = AbortSignal.any([requestSignal, attemptTimeout]);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: attemptSignal,
      });
      if (attemptTimeout.aborted) throw new GoogleApiError(504, "attempt_timeout", null, false);
      if (!response.ok) {
        const details = await response.text().catch(() => "");
        checkAbort();
        throw parseGoogleError(response.status, details, response.headers.get("retry-after"));
      }
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        checkAbort();
        if (attemptTimeout.aborted) throw new GoogleApiError(504, "attempt_timeout", null, false);
        throw new Error("O Google Gemini retornou uma resposta inválida. Tente novamente.");
      }
      checkAbort();
      if (attemptTimeout.aborted) throw new GoogleApiError(504, "attempt_timeout", null, false);
      const text = getResponseText(data, attempt.transport);
      return {
        text,
        model: attempt.model,
        usedAlternative: index > 0,
        switchedModel: attempt.model !== primaryModel,
      };
    } catch (error) {
      checkAbort();
      const apiError = attemptTimeout.aborted
        ? new GoogleApiError(504, "attempt_timeout", null, false)
        : error instanceof GoogleApiError ? error : null;
      const networkError = error instanceof TypeError;
      if (!apiError && !networkError) throw error;
      if (apiError) previousError = apiError;

      // Não repetir credenciais, permissões, argumentos inválidos ou cota diária.
      if (apiError && !retryableStatus(apiError.status) && apiError.status !== 404 && apiError.status !== 501) {
        throw new Error(friendlyGeminiError(apiError));
      }
      if (apiError?.status === 429 && (isDailyQuota(apiError) || index > 0)) {
        throw new Error(friendlyGeminiError(apiError));
      }
      if (apiError?.retryAfterMs !== null && apiError?.retryAfterMs !== undefined && apiError.retryAfterMs > MAX_RETRY_AFTER_MS) {
        throw new Error(friendlyGeminiError(apiError));
      }

      let nextIndex = index + 1;
      // Se Interactions não estiver disponível, passe à próxima API compatível.
      if (apiError && (apiError.status === 404 || apiError.status === 501) && attempt.transport === "interactions") {
        const alternate = attempts.findIndex((candidate, position) => position > index && candidate.transport === "generateContent");
        if (alternate >= 0) nextIndex = alternate;
      }
      // Um limite de cota não deve ser contornado trocando de modelo.
      if (apiError?.status === 429 && (nextIndex > 1 || attempts[nextIndex]?.model !== attempt.model)) {
        throw new Error(friendlyGeminiError(apiError));
      }
      if (nextIndex >= attempts.length) {
        if (previousError) throw new Error(friendlyGeminiError(previousError));
        throw new Error("Não foi possível conectar ao Google Gemini após novas tentativas. Seus arquivos continuam selecionados; verifique a conexão e tente novamente.");
      }

      const next = attempts[nextIndex];
      onRetry?.(next.transport === attempt.transport && next.model === attempt.model ? "retrying" : "alternative");
      const base = Math.max(0, retryBaseDelayMs) * 2 ** Math.min(index, 2);
      const backoff = base + (base ? Math.floor(Math.random() * base * 0.25) : 0);
      const delay = Math.max(backoff, apiError?.retryAfterMs ?? 0);
      try {
        await waitForRetry(delay, requestSignal);
      } catch {
        checkAbort();
        throw new Error("Não foi possível conectar ao Google Gemini. Tente novamente.");
      }
      index = nextIndex;
    }
  }
  throw new Error("Não foi possível concluir a análise. Tente novamente.");
}

/** Compatibilidade para chamadas que precisam apenas do texto. */
export async function createGeminiInteraction(request: GeminiRequest): Promise<string> {
  return (await createGeminiInteractionDetailed(request)).text;
}
