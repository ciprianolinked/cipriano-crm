import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";

export const dynamic = "force-dynamic";

const FIELDS = [
  "name",
  "company",
  "contactName",
  "email",
  "phone",
  "document",
  "address",
  "city",
  "state",
  "segment",
  "source",
  "notes",
] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const patch: Record<string, string | null> = {};
  for (const field of FIELDS) {
    if (field in body) {
      const value = String(body[field] ?? "").trim();
      patch[field] = value || null;
    }
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });

  const [row] = await db
    .update(clients)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  return NextResponse.json({ client: row });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(clients).where(eq(clients.id, id));
  return NextResponse.json({ ok: true });
}
