import { NextResponse } from "next/server";
import { deleteQuotation, getQuotation, updateQuotation } from "@/lib/server/quotations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const quotation = await getQuotation(id);
  if (!quotation) {
    return NextResponse.json({ error: "Mapa de cotação não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ quotation });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const payload = await request.json();
    const quotation = await updateQuotation(id, payload?.draft ?? payload);
    if (!quotation) {
      return NextResponse.json({ error: "Mapa de cotação não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ quotation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar mapa de cotação.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = await deleteQuotation(id);
  if (!deleted) {
    return NextResponse.json({ error: "Mapa de cotação não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
