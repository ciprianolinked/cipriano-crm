import { NextResponse } from "next/server";
import { recordPdfExport } from "@/lib/server/downloads";
import { buildMapPdf } from "@/lib/server/pdf";
import { getQuotation, isUuid } from "@/lib/server/quotations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Mapa não encontrado." }, { status: 404 });
  const record = await getQuotation(id).catch(() => null);
  if (!record) return NextResponse.json({ error: "Mapa não encontrado." }, { status: 404 });

  try {
    const { buffer, fileName } = await buildMapPdf(record, record.protocol);
    const exportRecord = await recordPdfExport({
      fileName,
      kind: "mapa",
      sizeBytes: buffer.byteLength,
      referenceId: record.id,
      protocol: record.protocol,
      condominium: record.condominium || null,
    }).catch(() => null);

    return NextResponse.json({
      fileName,
      fileBase64: buffer.toString("base64"),
      sizeBytes: buffer.byteLength,
      generatedAt: new Date().toISOString(),
      recorded: Boolean(exportRecord),
      exportId: exportRecord?.id ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível gerar o PDF do mapa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
