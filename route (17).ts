import { NextResponse } from "next/server";
import { addMonths } from "@/lib/maintenance";
import { getMaintenanceData } from "@/lib/maintenance-db";
import { db } from "@/db";
import { maintenanceContracts } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getMaintenanceData();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    clientId?: string | null;
    clientName?: string;
    title?: string;
    description?: string;
    monthlyValue?: number;
    startDate?: string;
    cycleMonths?: number;
  };

  const clientName = String(body.clientName ?? "").trim();
  const title = String(body.title ?? "").trim();
  const monthly = Number(body.monthlyValue ?? 0);
  if (!clientName || !title || !Number.isFinite(monthly) || monthly <= 0) {
    return NextResponse.json(
      { error: "Informe cliente, título do contrato e valor mensal maior que zero." },
      { status: 400 },
    );
  }

  const startDate = body.startDate ? new Date(`${body.startDate}T12:00:00`) : new Date();
  const cycle = Math.max(12, Math.round(Number(body.cycleMonths ?? 12) || 12));

  const [row] = await db
    .insert(maintenanceContracts)
    .values({
      clientId: body.clientId || null,
      clientName,
      title,
      description: String(body.description ?? "").trim() || null,
      monthlyCents: Math.round(monthly * 100),
      startDate,
      cycleMonths: cycle,
      nextReadjustAt: addMonths(startDate, cycle),
    })
    .returning();

  return NextResponse.json({ contract: row }, { status: 201 });
}
