import { NextResponse } from "next/server";
import { condominiumError, deleteCondominium, updateCondominium } from "@/lib/server/condominiums";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const payload: unknown = await request.json();
    const condominium = await updateCondominium(id, payload);
    if (!condominium) return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 404 });
    return NextResponse.json({ condominium });
  } catch (error) {
    return NextResponse.json({ error: condominiumError(error) }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const result = await deleteCondominium(id);
    if (result === "not_found") return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 404 });
    if (result === "has_quotations") return NextResponse.json({ error: "Este condomínio possui mapas vinculados. Preserve o cadastro ou exclua os mapas antes de removê-lo." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: condominiumError(error) }, { status: 400 });
  }
}
