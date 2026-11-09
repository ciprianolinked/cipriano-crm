import { NextResponse } from "next/server";
import { createCondominium, condominiumError } from "@/lib/server/condominiums";
import { listCondominiums } from "@/lib/server/quotations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ condominiums: await listCondominiums() });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar os condomínios." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    const condominium = await createCondominium(payload);
    return NextResponse.json({ condominium }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: condominiumError(error) }, { status: 400 });
  }
}
