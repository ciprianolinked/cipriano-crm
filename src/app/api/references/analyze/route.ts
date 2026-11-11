import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { referenceFiles } from "@/db/schema";
import { withReferenceSchema } from "@/lib/db-migrations";
import { getSettings } from "@/lib/data";
import { isTextReference } from "@/lib/references";
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

const fail = (message: string, status = 500) =>
  NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return fail("Requisição inválida: era esperado JSON.", 400);
    }

    const rows = await withReferenceSchema(() =>
      db
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
      .orderBy(asc(referenceFiles.createdAt)),
    );

    if (!rows.length) {
      return fail("Envie ao menos uma proposta do concorrente antes de analisar.", 400);
    }

    const documents: ReferenceDocumentInput[] = rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      extractedText: row.manualText?.trim() || row.extractedText || "",
      manualText: row.manualText,
      note: row.note,
      pages: isTextReference(row.mimeType) ? null : (row.analysis?.pages ?? null),
      // Transcrição manual tem prioridade; senão usamos as colunas do PDF.
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

    const type = typeof body.type === "string" && isProposalType(body.type) ? body.type : "completa";
    const validity = Number(body.validityDays);
    const draft = buildMatchedProposal({
      analysis,
      type,
      clientName: String(body.clientName ?? "").trim(),
      contact: String(body.contact ?? ""),
      clientEmail: String(body.clientEmail ?? ""),
      site: String(body.site ?? ""),
      validityDays:
        Number.isFinite(validity) && validity >= 1 && validity <= 365
          ? Math.round(validity)
          : settings.defaultValidityDays,
      settings: generatorSettings,
    });

    const totals = calcTotals(draft.items, draft.discountPct);
    return NextResponse.json(
      {
        analysis,
        draft,
        totals,
        insights: matchedInsights(analysis, totals),
        aiNote: `${analysis.source}. ${analysis.items.length} itens em ${rows.length} arquivo(s); ${analysis.scopes.length} escopo(s) separados. Valores igualados para edição posterior.`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[references/analyze] falhou:", (error as Error)?.message);
    return fail(
      "Não foi possível analisar os arquivos agora. Verifique /diagnostico, confirme a tabela reference_files e tente novamente.",
    );
  }
}
