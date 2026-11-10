import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  activities,
  appSettings,
  clients,
  maintenanceContracts,
  maintenanceDocumentRevisions,
  maintenanceReadjusts,
  proposals,
  referenceFiles,
} from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Zera os dados de operação (propostas, CRM, clientes, manutenção) para
 * começar de fato. Identidade e catálogo são preservados por padrão.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { confirm?: string };
  const confirm = String(body.confirm ?? "").trim().toUpperCase();
  if (confirm !== "ZERAR") {
    return NextResponse.json({ error: 'Digite "ZERAR" para confirmar.' }, { status: 400 });
  }

  await db.delete(maintenanceDocumentRevisions);
  const references = await db.delete(referenceFiles).returning({ id: referenceFiles.id });
  const readjusts = await db.delete(maintenanceReadjusts).returning({ id: maintenanceReadjusts.id });
  const contracts = await db.delete(maintenanceContracts).returning({ id: maintenanceContracts.id });
  const acts = await db.delete(activities).returning({ id: activities.id });
  const props = await db.delete(proposals).returning({ id: proposals.id });
  const cli = await db.delete(clients).returning({ id: clients.id });

  const [settings] = await db.select().from(appSettings).limit(1);
  if (settings) {
    await db
      .update(appSettings)
      .set({ proposalCounter: 0, updatedAt: new Date() })
      .where(eq(appSettings.id, settings.id));
  }

  return NextResponse.json({
    ok: true,
    removed: {
      readjusts: readjusts.length,
      references: references.length,
      contracts: contracts.length,
      activities: acts.length,
      proposals: props.length,
      clients: cli.length,
      catalogItems: 0,
    },
  });
}
