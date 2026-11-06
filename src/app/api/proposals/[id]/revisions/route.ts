import { NextResponse } from "next/server";
import { listRevisions } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const revisions = await listRevisions(id);
  return NextResponse.json({ revisions });
}
