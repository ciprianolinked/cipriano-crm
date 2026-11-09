import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, proposals } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { done?: boolean; content?: string; dueAt?: string | null };

  const patch: Record<string, unknown> = {};
  if (typeof body.done === "boolean") patch.doneAt = body.done ? new Date() : null;
  if (typeof body.content === "string") patch.content = body.content;
  if (body.dueAt !== undefined) patch.dueAt = body.dueAt ? new Date(body.dueAt) : null;

  const [row] = await db.update(activities).set(patch).where(eq(activities.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Atividade não encontrada." }, { status: 404 });

  if (row.kind === "seguimento") {
    if (row.doneAt) {
      const others = await db.select().from(activities).where(eq(activities.proposalId, row.proposalId));
      const next = others
        .filter((a) => a.kind === "seguimento" && !a.doneAt && a.id !== row.id && a.dueAt)
        .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())[0];
      await db
        .update(proposals)
        .set({
          nextActionAt: next?.dueAt ?? null,
          nextActionNote: next?.content ?? null,
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, row.proposalId));
    } else if (row.dueAt) {
      await db
        .update(proposals)
        .set({ nextActionAt: row.dueAt, nextActionNote: row.content, updatedAt: new Date() })
        .where(eq(proposals.id, row.proposalId));
    }
  }

  return NextResponse.json({ activity: row });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(activities).where(eq(activities.id, id));
  return NextResponse.json({ ok: true });
}
