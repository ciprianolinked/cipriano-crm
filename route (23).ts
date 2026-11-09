import { NextResponse } from "next/server";
import { createSourceExport, createSourceExportBatch, getSourceExportInfo } from "@/lib/source-export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const wantsZip = url.searchParams.get("formato") === "zip";
    const batchParam = url.searchParams.get("lote");
    if (!wantsZip) {
      return NextResponse.json(await getSourceExportInfo(), { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    const archive = batchParam ? await createSourceExportBatch(Number(batchParam)) : null;
    const fullArchive = batchParam ? null : await createSourceExport();
    const buffer = archive?.buffer ?? fullArchive!.buffer;
    const filename = archive?.batch.filename ?? fullArchive!.info.filename;
    const fileCount = archive?.batch.fileCount ?? fullArchive!.info.fileCount;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Project-File-Count": String(fileCount),
        ...(archive ? { "X-Project-Upload-Batch": `${archive.batch.part}/${archive.batch.total}` } : {}),
      },
    });
  } catch {
    console.error("[publicacao] O pacote de código não pôde ser preparado.");
    return NextResponse.json({ error: "Não foi possível preparar o pacote agora. Tente novamente; nenhum dado do banco é incluído no download." }, { status: 503 });
  }
}
