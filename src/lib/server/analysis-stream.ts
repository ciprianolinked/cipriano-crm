import type { AiAnalysisEvent, AiAnalysisPhase } from "@/lib/ai-stream";
import type { AiExtractionResult } from "@/lib/types";

/**
 * Mantém a resposta ativa durante a chamada à IA e entrega o resultado completo
 * apenas quando o processamento terminar. Não salva os documentos nem a chave.
 */
export function createAiAnalysisStream(
  run: (signal: AbortSignal, onPhase: (phase: AiAnalysisPhase) => void) => Promise<AiExtractionResult>,
  options: { signal?: AbortSignal; heartbeatMs?: number } = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const cancellation = new AbortController();
  const operationSignal = options.signal
    ? AbortSignal.any([options.signal, cancellation.signal])
    : cancellation.signal;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  function cleanup() {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      function send(event: AiAnalysisEvent) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
          cleanup();
          cancellation.abort();
        }
      }

      send({ type: "progress", phase: "recebido" });
      send({ type: "progress", phase: "analisando" });
      heartbeat = setInterval(() => send({ type: "heartbeat" }), options.heartbeatMs ?? 8_000);

      void Promise.resolve()
        .then(() => run(operationSignal, (phase) => send({ type: "progress", phase })))
        .then((result) => send({ type: "result", result }))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Não foi possível concluir a análise.";
          send({ type: "error", error: message });
        })
        .finally(() => {
          cleanup();
          if (!closed) {
            closed = true;
            controller.close();
          }
        });
    },
    cancel() {
      closed = true;
      cleanup();
      cancellation.abort();
    },
  });
}
