import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, proposals } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as {
    kind?: string;
    content?: string;
    dueAt?: string | null;
    done?: boolean;
  };
  const content = String(body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "Descreva a interação ou o lembrete." }, { status: 400 });

  const kind = body.kind ?? "nota";
  const dueAt = body.dueAt ? new Date(body.dueAt) : null;

  const [row] = await db
    .insert(activities)
    .values({
      proposalId: id,
      kind,
      content,
      dueAt,
      doneAt: body.done ? new Date() : null,
    })
    .returning();

  if (kind === "seguimento" && dueAt) {
    await db
      .update(proposals)
      .set({ nextActionAt: dueAt, nextActionNote: content, updatedAt: new Date() })
      .where(eq(proposals.id, id));
  } else if (body.done) {
    await db
      .update(proposals)
      .set({ nextActionAt: null, nextActionNote: null, updatedAt: new Date() })
      .where(eq(proposals.id, id));
  }

  return NextResponse.json({ activity: row }, { status: 201 });
}
