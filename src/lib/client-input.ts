import { formatCnpj, isValidCnpj, normalizeDocument } from "@/lib/cnpj";

const FIELDS = ["name", "company", "contactName", "email", "phone", "document", "address", "city", "state", "segment", "source", "notes"] as const;
export function parseClientInput(body: Record<string, unknown>, partial = false) {
  const values: Partial<Record<(typeof FIELDS)[number], string | null>> = {};
  for (const field of FIELDS) if (field in body || !partial) {
    const value = String(body[field] ?? "").trim();
    if (value.length > (field === "notes" ? 10000 : 1000)) throw new Error("Um dos campos excede o tamanho permitido.");
    values[field] = value || null;
  }
  if ((!partial || "name" in values) && !values.name) throw new Error("Informe o nome do cliente.");
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) throw new Error("Confira o e-mail informado.");
  if (values.document) {
    const normalized = normalizeDocument(values.document);
    if (normalized.length === 14) {
      if (!isValidCnpj(normalized)) throw new Error("CNPJ inválido. Confira o documento ou deixe o campo vazio para cadastrar manualmente.");
      values.document = formatCnpj(normalized);
    } else if (!/^\d{11}$/.test(normalized)) throw new Error("Informe um CNPJ válido, um CPF com 11 dígitos ou deixe o documento vazio.");
  }
  return values;
}
