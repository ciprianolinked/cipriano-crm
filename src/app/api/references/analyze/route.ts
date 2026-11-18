import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { referenceFiles } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { ensureSchema } from "@/lib/db-migrations";
import { calcTotals } from "@/lib/proposal/catalog";
import { isProposalType, type ProposalType } from "@/lib/proposal/types";
import {
  analyzeCompetitorDocuments,
  buildMatchedProposal,
  matchedInsights,
  type ReferenceDocumentInput,
} from "@/lib/references-analysis";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await ensureSchema();
  const body = (await request.json().catch(() => ({}))) as {
    type?: string;
    clientName?: string;
    contact?: string;
    clientEmail?: string;
    site?: string;
    validityDays?: number;
  };

  const rows = await db
    .select({
      id: referenceFiles.id,
      fileName: referenceFiles.fileName,
      extractedText: referenceFiles.extractedText,
      manualText: referenceFiles.manualText,
      note: referenceFiles.note,
      layoutRows: referenceFiles.layoutRows,
      analysis: referenceFiles.analysis,
    })
    .from(referenceFiles)
    .orderBy(asc(referenceFiles.createdAt));

  if (!rows.length) {
    return NextResponse.json(
      { error: "Envie ao menos uma proposta de referência antes de analisar." },
      { status: 400 },
    );
  }

  const docs: ReferenceDocumentInput[] = rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    extractedText: row.extractedText,
    manualText: row.manualText,
    note: row.note,
    pages: row.analysis?.pages ?? null,
    layoutRows: row.layoutRows ?? row.analysis?.layoutRows ?? null,
  }));

  const analysis = analyzeCompetitorDocuments(docs);
  if (!analysis.items.length && analysis.matchedValue <= 0) {
    return NextResponse.json(
      {
        error:
          analysis.warnings[0] ??
          "Nenhum equipamento ou valor legível encontrado. Em PDFs escaneados ou imagens, clique em Transcrever para colar os itens.",
      },
      { status: 400 },
    );
  }

  const settings = await getSettings();
  const type: ProposalType = body.type && isProposalType(body.type) ? body.type : "completa";
  const validityDays = Math.max(1, Number(body.validityDays) || settings.defaultValidityDays || 15);

  const draft = buildMatchedProposal({
    analysis,
    type,
    clientName: String(body.clientName ?? "").trim() || "Cliente a definir",
    contact: String(body.contact ?? "").trim(),
    clientEmail: String(body.clientEmail ?? "").trim(),
    site: String(body.site ?? "").trim(),
    validityDays,
    settings,
  });

  const totals = calcTotals(draft.items, draft.discountPct);
  const insights = matchedInsights(analysis, totals);

  return NextResponse.json({
    analysis,
    draft,
    totals,
    insights,
    aiNote: analysis.note,
  });
}
