import type { AiExtractionResult } from "./types";

/** Etapas verificáveis: recebimento pelo servidor e envio ao serviço de IA. */
export type AiAnalysisPhase =
  | "recebido"
  | "analisando"
  | "tentando_novamente"
  | "alternativa"
  | "pesquisando";

/** Protocolo de acompanhamento da análise, uma mensagem JSON por linha. */
export type AiAnalysisEvent =
  | { type: "progress"; phase: AiAnalysisPhase }
  | { type: "heartbeat" }
  | { type: "result"; result: AiExtractionResult }
  | { type: "error"; error: string };
