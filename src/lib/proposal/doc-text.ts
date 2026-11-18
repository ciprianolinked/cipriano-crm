/**
 * Textos fixos do documento (rótulos, cabeçalhos de tabela, assinaturas, selos, rodapé)
 * que o usuário pode sobrescrever dentro da própria proposta.
 * Ficam em `briefing.docText`, sem exigir alteração no banco.
 */
export type DocTexts = Record<string, string>;

export function readDocTexts(briefing: unknown): DocTexts {
  if (!briefing || typeof briefing !== "object") return {};
  const raw = (briefing as { docText?: unknown }).docText;
  if (!raw || typeof raw !== "object") return {};
  const out: DocTexts = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/** Devolve o texto personalizado (mesmo vazio) ou o padrão. */
export function tx(texts: DocTexts | undefined, key: string, fallback: string): string {
  return texts && Object.prototype.hasOwnProperty.call(texts, key) ? texts[key] : fallback;
}

export const DEFAULT_SEALS = ["CFTV IP", "Controle de acesso", "Perímetro", "Alarme", "LGPD"];
