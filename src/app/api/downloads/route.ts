import { NextResponse } from "next/server";
import { listPdfExports, listPdfExportsForQuotation } from "@/lib/server/downloads";
import { isUuid } from "@/lib/server/quotations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const quotationId = new URL(request.url).searchParams.get("mapa");
  try {
    const exports = quotationId && isUuid(quotationId)
      ? await listPdfExportsForQuotation(quotationId)
      : await listPdfExports(10);
    return NextResponse.json({ exports });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar o histórico de downloads." }, { status: 500 });
  }
}
