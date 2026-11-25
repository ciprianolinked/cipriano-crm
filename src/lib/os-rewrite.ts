export const OS_TEXT_FIELDS = ["description", "diagnosis", "solution", "notes"] as const;
export type OsTextKey = (typeof OS_TEXT_FIELDS)[number];
export type OsTexts = Record<OsTextKey, string>;
export const OS_TEXT_LABELS: Record<OsTextKey, string> = {
  description: "Solicitação", diagnosis: "Diagnóstico", solution: "Solução", notes: "Observações",
};
export type OsRewriteResponse = {
  blocks: OsTexts;
  changed: OsTextKey[];
  source: "llm";
  message: string;
};
export type OsTextChange = { key: OsTextKey; before: string; after: string };

export function pickOsTexts(value: OsTexts): OsTexts {
  return Object.fromEntries(OS_TEXT_FIELDS.map((key) => [key, value[key]])) as OsTexts;
}

export function normalizeOsText(value: string) {
  return value.normalize("NFC").replace(/\r\n/g, "\n").trim();
}

export function readOsTexts(value: unknown): OsTexts {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Envie os textos atuais da OS para reescrever.");
  const record = value as Record<string, unknown>;
  const out = {} as OsTexts;
  for (const key of OS_TEXT_FIELDS) {
    if (typeof record[key] !== "string") throw new Error(`O campo ${OS_TEXT_LABELS[key]} deve ser um texto.`);
    if (record[key].length > 8000) throw new Error(`${OS_TEXT_LABELS[key]} excede o limite de 8.000 caracteres por campo.`);
    out[key] = record[key];
  }
  if (Object.values(out).join("").length > 24000) throw new Error("Os textos da OS excedem 24.000 caracteres. Reescreva em partes.");
  return out;
}

/** Never replace a field that the user continued editing while the request was running. */
export function mergeOsRewrite(current: OsTexts, submitted: OsTexts, result: OsTexts) {
  const patch: Partial<OsTexts> = {};
  const changes: OsTextChange[] = [];
  const skipped: OsTextKey[] = [];
  for (const key of OS_TEXT_FIELDS) {
    if (normalizeOsText(result[key]) === normalizeOsText(submitted[key])) continue;
    if (current[key] !== submitted[key]) { skipped.push(key); continue; }
    patch[key] = result[key];
    changes.push({ key, before: current[key], after: result[key] });
  }
  return { patch, changes, skipped };
}
