import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { activities, proposals } from "@/db/schema";
import { nextProposalNumber } from "@/lib/data";
import { isProposalType } from "@/lib/proposal/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { revision?: boolean };
  const isRevision = body.revision === true;

  const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  if (rows.length === 0) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  const source = rows[0];
  const groupId = source.revisionGroupId ?? source.id;
  const family = isRevision
    ? await db.select({ revision: proposals.revision }).from(proposals).where(or(eq(proposals.id, groupId), eq(proposals.revisionGroupId, groupId)))
    : [];
  const number = await nextProposalNumber();

  const revisionNumber = isRevision ? Math.max(source.revision ?? 1, ...family.map((r) => r.revision)) + 1 : 1;
  const parentId = isRevision ? id : null;
  const revisionGroupId = isRevision ? groupId : source.id;

  const [row] = await db
    .insert(proposals)
    .values({
      number,
      type: isProposalType(source.type) ? source.type : "completa",
      status: "novo",
      revision: revisionNumber,
      parentProposalId: parentId,
      revisionGroupId,
      clientId: source.clientId,
      clientName: source.clientName,
      contact: source.contact,
      clientEmail: source.clientEmail,
      site: source.site,
      validityDays: source.validityDays,
      discountPct: source.discountPct,
      items: source.items,
      sections: source.sections,
      paymentTerms: source.paymentTerms,
      deliveryTime: source.deliveryTime,
      warranty: source.warranty,
      artIncluded: source.artIncluded,
      subtotalCents: source.subtotalCents,
      totalCents: source.totalCents,
      briefing: source.briefing,
      nextActionAt: new Date(),
      nextActionNote: `Revisão ${revisionNumber}: revisar valores e escopo antes do envio.`,
    })
    .returning();

  await db.insert(activities).values({
    proposalId: row.id,
    kind: "sistema",
    content: `Revisão ${revisionNumber} gerada a partir da proposta ${source.number}.`,
    doneAt: new Date(),
  });

  return NextResponse.json({ proposal: row, isRevision }, { status: 201 });
}
