import { NextResponse } from "next/server";
import { compareIndexes, isOfficialIndex, parseManualPct } from "@/lib/indices";
import { getIndexObservations, saveIndexObservation, syncIndexesFromBcb } from "@/lib/indices-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const observations = await getIndexObservations();
  return NextResponse.json({ observations, comparison: compareIndexes(observations) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { action?: string; indexName?: string; month?: string; pct?: string | number };
  if (body.action === "sync") {
    const results = await syncIndexesFromBcb();
    const observations = await getIndexObservations();
    return NextResponse.json({ results, comparison: compareIndexes(observations) });
  }
  const pct = parseManualPct(body.pct);
  if (!body.indexName || !isOfficialIndex(body.indexName) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month ?? "") || pct === null) {
    return NextResponse.json({ error: "Informe índice, mês válido e percentual mensal entre -100% e 1000%." }, { status: 400 });
  }
  const row = await saveIndexObservation(body.indexName, body.month!, pct);
  return NextResponse.json({ row }, { status: 201 });
}
