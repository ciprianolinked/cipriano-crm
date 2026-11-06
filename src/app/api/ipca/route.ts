import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ipcaHistory } from "@/db/schema";
import { parsePercentToHundredths } from "@/lib/maintenance";
import { getIpcaHistory, syncIpcaFromIbge, upsertIpcaMonth } from "@/lib/maintenance-db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ history: await getIpcaHistory() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { action?: string; month?: string; pct?: number | string };

  if (body.action === "sync") {
    const result = await syncIpcaFromIbge();
    return NextResponse.json(result, { status: result.error ? 207 : 200 });
  }

  const month = String(body.month ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Use o formato AAAA-MM (ex.: 2026-01)." }, { status: 400 });
  }
  const pct = parsePercentToHundredths(body.pct ?? "");
  if (pct === null || pct < 0) {
    return NextResponse.json({ error: "Informe o IPCA do mês em % (ex.: 0,42)." }, { status: 400 });
  }
  const row = await upsertIpcaMonth(month, pct, "manual");
  return NextResponse.json({ row }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  if (!month) return NextResponse.json({ error: "Mês obrigatório." }, { status: 400 });
  await db.delete(ipcaHistory).where(eq(ipcaHistory.month, month));
  return NextResponse.json({ ok: true });
}
