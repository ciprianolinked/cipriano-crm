import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { referenceFiles } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { analyzeReferenceText, isTextReference } from "@/lib/references";
import {
  analyzeCompetitorDocuments,
  buildMatchedProposal,
  matchedInsights,
  type ReferenceDocumentInput,
} from "@/lib/references-analysis";
import { calcTotals } from "@/lib/proposal/catalog";
import { isProposalType } from "@/lib/proposal/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Requisição inválida: era esperado JSON." }, { status: 400 });
  }

  const rows = await db
    .select({
      id: referenceFiles.id,
      fileName: referenceFiles.fileName,
      mimeType: referenceFiles.mimeType,
      extractedText: referenceFiles.extractedText,
      manualText: referenceFiles.manualText,
      layoutRows: referenceFiles.layoutRows,
      note: referenceFiles.note,
      analysis: referenceFiles.analysis,
    })
    .from(referenceFiles)
    .orderBy(asc(referenceFiles.createdAt));

  if (!rows.length) {
    return NextResponse.json(
      { error: "Envie ao menos uma proposta do concorrente antes de analisar." },
      { status: 400 },
    );
  }

  const documents: ReferenceDocumentInput[] = rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    // Texto digitado tem prioridade: permite analisar imagem/PDF escaneado transcrito.
    extractedText: row.manualText?.trim() || row.extractedText || "",
    manualText: row.manualText,
    note: row.note,
    pages: isTextReference(row.mimeType) ? null : (row.analysis?.pages ?? null),
    // Quando há transcrição manual, ela manda; senão usamos as colunas reconstruídas do PDF.
    layoutRows: row.manualText?.trim() ? null : (row.layoutRows ?? row.analysis?.layoutRows ?? null),
  }));

  const analysis = analyzeCompetitorDocuments(documents);
  const settings = await getSettings();
  const generatorSettings = {
    defaultValidityDays: settings.defaultValidityDays,
    defaultPaymentTerms: settings.defaultPaymentTerms,
    defaultDeliveryTime: settings.defaultDeliveryTime,
    defaultWarranty: settings.defaultWarranty,
    companyName: settings.companyName,
    legalName: settings.legalName,
    director: settings.director,
    role: settings.role,
    crea: settings.crea,
    cnpj: settings.cnpj,
  };
  const typeValue = typeof body.type === "string" && isProposalType(body.type) ? body.type : "completa";
  const validityDays = Number(body.validityDays);
  const draft = buildMatchedProposal({
    analysis,
    type: typeValue,
    clientName: String(body.clientName ?? "").trim(),
    contact: String(body.contact ?? ""),
    clientEmail: String(body.clientEmail ?? ""),
    site: String(body.site ?? ""),
    validityDays: Number.isFinite(validityDays) && validityDays >= 1 && validityDays <= 365 ? Math.round(validityDays) : settings.defaultValidityDays,
    settings: generatorSettings,
  });

  const totals = calcTotals(draft.items, draft.discountPct);
  return NextResponse.json({
    analysis,
    draft,
    totals,
    insights: matchedInsights(analysis, totals),
    aiNote: `${analysis.source}. ${analysis.items.length} itens lidos em ${rows.length} arquivo(s); ${analysis.scopes.length} escopo(s) separados. Valores igualados para edição posterior.`,
  });
}

/** Recalcula a leitura simples de preços de um arquivo após transcrição manual. */
export async function GET() {
  const rows = await db.select({ id: referenceFiles.id, fileName: referenceFiles.fileName, extractedText: referenceFiles.extractedText }).from(referenceFiles);
  return NextResponse.json({
    documents: rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      prices: analyzeReferenceText(row.extractedText ?? "", null).prices.slice(0, 10),
    })),
  });
}
