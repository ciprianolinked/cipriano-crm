import { NextResponse } from "next/server";
import { createQuotation, listQuotations } from "@/lib/server/quotations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const quotations = await listQuotations();
    return NextResponse.json({ quotations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar mapas de cotação.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const quotation = await createQuotation(payload?.draft ?? payload);
    return NextResponse.json({ quotation }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar mapa de cotação.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
