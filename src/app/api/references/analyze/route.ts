import { NextResponse } from "next/server";
import { getSettings } from "@/lib/data";
import { calcTotals } from "@/lib/proposal/catalog";
import type { GeneratorSettings } from "@/lib/proposal/generate";
import { isProposalType, type ProposalType } from "@/lib/proposal/types";
import {
  analyzeCompetitorDocuments,
  buildMatchedProposal,
  matchedInsights,
  type ReferenceDocumentInput,
} from "@/lib/references-analysis";
import { ensureReferenceTable, listReferenceRows } from "@/lib/references-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type AnalysisContext = {
  type?: string;
  clientName?: string;
  contact?: string;
  clientEmail?: string;
  site?: string;
  validityDays?: number;
};

export async function POST(request: Request) {
  try {
    await ensureReferenceTable();
    const body = (await request.json().catch(() => ({}))) as AnalysisContext;
    const settings = await getSettings();
    const type: ProposalType = body.type && isProposalType(body.type) ? body.type : "completa";
    const validityDays = Math.min(365, Math.max(1, Number(body.validityDays ?? settings.defaultValidityDays) || 15));
    const rows = await listReferenceRows();

    const documents: ReferenceDocumentInput[] = rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      extractedText: row.extractedText ?? null,
      manualText: row.manualText ?? null,
      note: row.note ?? null,
      pages: row.analysis?.pages ?? null,
      layoutRows: row.layoutRows ?? null,
    }));

    const analysis = analyzeCompetitorDocuments(documents);
    const generatorSettings: GeneratorSettings = {
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

    const draft = buildMatchedProposal({
      analysis,
      type,
      clientName: body.clientName ?? "",
      contact: body.contact ?? "",
      clientEmail: body.clientEmail ?? "",
      site: body.site ?? "",
      validityDays,
      settings: generatorSettings,
    });
    const totals = calcTotals(draft.items, draft.discountPct);
    const insights = matchedInsights(analysis, totals);

    return NextResponse.json(
      {
        analysis,
        draft,
        totals,
        insights,
        aiNote: `Proposta igualada a ${documents.length} arquivo(s) de referência. Escopos separados por disciplina, quantidades preservadas e nenhum desconto automático. Revise os preços antes de salvar.`,
      },
      { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (error) {
    console.error("[references] Falha na análise:", (error as Error)?.message);
    return NextResponse.json(
      { error: "Não foi possível analisar os arquivos. Confira /api/health e tente novamente." },
      { status: 503 },
    );
  }
}
