import { NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { ensureBootstrap, listClients } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureBootstrap();
  return NextResponse.json({ clients: await listClients() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Nome do cliente é obrigatório." }, { status: 400 });

  const [row] = await db
    .insert(clients)
    .values({
      name,
      company: String(body.company ?? "") || null,
      contactName: String(body.contactName ?? "") || null,
      email: String(body.email ?? "") || null,
      phone: String(body.phone ?? "") || null,
      document: String(body.document ?? "") || null,
      address: String(body.address ?? "") || null,
      city: String(body.city ?? "") || null,
      state: String(body.state ?? "") || null,
      segment: String(body.segment ?? "") || null,
      source: String(body.source ?? "") || null,
      notes: String(body.notes ?? "") || null,
    })
    .returning();

  return NextResponse.json({ client: row }, { status: 201 });
}
