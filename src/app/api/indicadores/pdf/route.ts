import { NextResponse } from "next/server";
import { recordPdfExport } from "@/lib/server/downloads";
import { buildIndicatorsPdf } from "@/lib/server/pdf";
import { listQuotations } from "@/lib/server/quotations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { condominium?: unknown; start?: unknown; end?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const condominium = typeof body.condominium === "string" ? body.condominium.slice(0, 200) : "";
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(body.start)) ? String(body.start) : "";
  const end = /^\d{4}-\d{2}-\d{2}$/.test(String(body.end)) ? String(body.end) : "";

  try {
    const records = await listQuotations();
    const { buffer, fileName } = await buildIndicatorsPdf({
      condominium,
      start,
      end,
      generatedAt: new Date(),
      records,
    });
    const exportRecord = await recordPdfExport({
      fileName,
      kind: "indicadores",
      sizeBytes: buffer.byteLength,
      condominium: condominium || null,
      periodStart: start || null,
      periodEnd: end || null,
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
    const message = error instanceof Error ? error.message : "Não foi possível gerar o PDF dos indicadores.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
