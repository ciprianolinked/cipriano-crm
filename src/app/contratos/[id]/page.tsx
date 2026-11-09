import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { maintenanceContracts, maintenanceDocumentRevisions, maintenanceReadjusts } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { getIndexObservations } from "@/lib/indices-db";
import { deriveContract } from "@/lib/maintenance";
import { ContractEditor } from "@/components/maintenance/ContractEditor";
import { loadDatabasePage } from "@/components/system/load-database-page";

export const dynamic = "force-dynamic";
export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const loaded = await loadDatabasePage(async () => {
    const [row] = await db.select().from(maintenanceContracts).where(eq(maintenanceContracts.id, id)).limit(1);
    if (!row) notFound();
    const [observations, settings, revisions, readjusts] = await Promise.all([
      getIndexObservations(), getSettings(),
      db.select().from(maintenanceDocumentRevisions).where(eq(maintenanceDocumentRevisions.contractId, id)).orderBy(desc(maintenanceDocumentRevisions.revision)),
      db.select().from(maintenanceReadjusts).where(eq(maintenanceReadjusts.contractId, id)),
    ]);
    return { row, observations, settings, revisions, derived: deriveContract(row, readjusts, observations) };
  });
  if (!loaded.ok) return loaded.recovery;
  const { row, observations, settings, revisions, derived } = loaded.data;
  return <ContractEditor initial={{ ...derived, contractText: row.contractText }} observations={observations} revisions={revisions.map((r) => ({ id: r.id, revision: r.revision, body: r.body, note: r.note, createdAt: r.createdAt.toISOString() }))} aiEnabled={Boolean(process.env.OPENAI_API_KEY)} settings={{ companyName: settings.companyName, legalName: settings.legalName, tagline: settings.tagline, director: settings.director, role: settings.role, phone: settings.phone, landline: settings.landline, email: settings.email, site: settings.site, address: settings.address, cnpj: settings.cnpj, crea: settings.crea, hours: settings.hours }} />;
}
