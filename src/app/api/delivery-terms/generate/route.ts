import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { generateDeliveryTerm } from "@/lib/delivery-terms";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { proposalId?: string };
  const proposalId = String(body.proposalId ?? "");
  if (!proposalId) return NextResponse.json({ error: "Selecione uma proposta." }, { status: 400 });

  const rows = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  const proposal = rows[0];
  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  if (proposal.status !== "ganho") {
    return NextResponse.json({ error: "Marque a proposta como ganha antes de emitir o termo de entrega." }, { status: 409 });
  }

  const settings = await getSettings();
  const draft = await generateDeliveryTerm(proposal, settings);
  return NextResponse.json({ draft, source: draft.generatedByAi ? "ia" : "modelo" });
}
