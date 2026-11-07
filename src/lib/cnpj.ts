export const normalizeDocument = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

export function formatCnpj(value: string): string {
  const v = normalizeDocument(value).slice(0, 14);
  return v.replace(/^(.{2})(.)/, "$1.$2").replace(/^(.{2})\.(.{3})(.)/, "$1.$2.$3").replace(/^(.{2})\.(.{3})\.(.{3})(.)/, "$1.$2.$3/$4").replace(/(\/.{4})(.)/, "$1-$2");
}

/** Modulo 11; accepts numeric CNPJs and the alphanumeric base introduced in 2026. */
export function isValidCnpj(value: string): boolean {
  const v = normalizeDocument(value);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(v) || /^(.)\1{13}$/.test(v)) return false;
  const digit = (base: string, weights: number[]) => {
    const sum = [...base].reduce((total, char, i) => total + (char.charCodeAt(0) - 48) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const d1 = digit(v.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digit(v.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return v.endsWith(`${d1}${d2}`);
}

export type CnpjCompany = {
  document: string;
  name: string;
  company: string;
  address: string;
  city: string;
  state: string;
  email: string;
  phone: string;
  segment: string;
  registrationStatus: string;
};

export function mapCnpjCompany(data: Record<string, unknown>): CnpjCompany {
  const text = (key: string) => typeof data[key] === "string" || typeof data[key] === "number" ? String(data[key]).trim() : "";
  const cep = text("cep").replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2");
  const street = [text("descricao_tipo_de_logradouro"), text("logradouro")].filter(Boolean).join(" ");
  const company = text("razao_social");
  return {
    document: formatCnpj(text("cnpj")),
    name: text("nome_fantasia") || company,
    company,
    address: [street, text("numero"), text("complemento"), text("bairro"), cep ? `CEP ${cep}` : ""].filter(Boolean).join(", "),
    city: text("municipio"), state: text("uf"),
    email: text("email"), phone: text("ddd_telefone_1") || text("ddd_telefone_2"),
    segment: text("cnae_fiscal_descricao"),
    registrationStatus: text("descricao_situacao_cadastral"),
  };
}
