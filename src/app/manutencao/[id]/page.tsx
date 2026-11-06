import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { maintenanceContracts, maintenanceDocumentRevisions } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { getMaintenanceData } from "@/lib/maintenance-db";
import { ContractEditor } from "@/components/maintenance/ContractEditor";

export const dynamic = "force-dynamic";

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db.select().from(maintenanceContracts).where(eq(maintenanceContracts.id, id)).limit(1);
  if (!row) notFound();
  const [data, settings, revisions] = await Promise.all([
    getMaintenanceData(),
    getSettings(),
    db.select().from(maintenanceDocumentRevisions).where(eq(maintenanceDocumentRevisions.contractId, id)).orderBy(desc(maintenanceDocumentRevisions.revision)),
  ]);
  const derived = data.contracts.find((c) => c.id === id);
  if (!derived) notFound();
  return <ContractEditor initial={{ ...derived, contractText: row.contractText }} observations={data.observations} revisions={revisions.map((r) => ({ id: r.id, revision: r.revision, body: r.body, note: r.note, createdAt: r.createdAt.toISOString() }))} aiEnabled={Boolean(process.env.OPENAI_API_KEY)} settings={{ companyName: settings.companyName, phone: settings.phone, email: settings.email, cnpj: settings.cnpj }} />;
}
