import { NextResponse } from "next/server";
import { isValidCnpj, mapCnpjCompany, normalizeDocument } from "@/lib/cnpj";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ cnpj: string }> }) {
  const { cnpj: raw } = await params;
  const cnpj = normalizeDocument(raw);
  const reply = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  if (!isValidCnpj(cnpj)) return reply("CNPJ inválido. Confira os 14 caracteres e os dígitos verificadores ou continue com o cadastro manual.", 400);
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(cnpj)}`, {
      headers: { Accept: "application/json", "User-Agent": "CiprianoCRM/1.0" }, cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404) return reply("CNPJ não encontrado na base consultada. Você pode cadastrar o cliente manualmente.", 404);
    if (response.status === 429) return reply("Limite de consultas atingido. Aguarde alguns instantes ou preencha os dados manualmente.", 429);
    if (!response.ok) return reply("A consulta de CNPJ está indisponível. Nenhum dado foi alterado; continue manualmente ou tente novamente.", 502);
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return reply("A fonte retornou dados incompletos. Use o cadastro manual.", 502);
    const company = mapCnpjCompany(data as Record<string, unknown>);
    if (!company.company || normalizeDocument(company.document) !== cnpj) return reply("Não foi possível confirmar os dados desse CNPJ. Use o cadastro manual.", 502);
    return NextResponse.json({ company, source: "BrasilAPI / Minha Receita", consultedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return reply("A consulta demorou ou está indisponível. Você pode continuar o cadastro manualmente, sem perder o que digitou.", 503);
  }
}
