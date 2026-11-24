import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceOrders } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import { ensureBootstrap, getSettings } from "@/lib/data";
import { ServiceOrderEditor, type EditableOs } from "@/components/os/ServiceOrderEditor";
import { loadDatabasePage } from "@/components/system/load-database-page";

export const dynamic = "force-dynamic";

export default async function OsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadDatabasePage(async () => {
    await ensureSchema();
    await ensureBootstrap();
    const [os] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
    if (!os) notFound();
    const settings = await getSettings();
    return { os, settings };
  });
  if (!loaded.ok) return loaded.recovery;
  const { os, settings } = loaded.data;

  const editable: EditableOs = {
    id: os.id,
    number: os.number,
    kind: os.kind,
    status: os.status,
    priority: os.priority,
    clientName: os.clientName,
    contact: os.contact,
    phone: os.phone,
    email: os.email,
    site: os.site,
    description: os.description,
    diagnosis: os.diagnosis,
    solution: os.solution,
    technician: os.technician,
    scheduledAt: os.scheduledAt ? os.scheduledAt.toISOString() : null,
    startedAt: os.startedAt ? os.startedAt.toISOString() : null,
    finishedAt: os.finishedAt ? os.finishedAt.toISOString() : null,
    laborCents: os.laborCents,
    items: os.items,
    notes: os.notes,
    clientSignature: os.clientSignature,
    originProposalId: os.originProposalId,
    originProposalNumber: os.originProposalNumber,
    budgetProposalId: os.budgetProposalId,
    budgetProposalNumber: os.budgetProposalNumber,
    budgetTotalCents: os.budgetTotalCents,
    budgetIssuedAt: os.budgetIssuedAt ? os.budgetIssuedAt.toISOString() : null,
    createdAt: os.createdAt.toISOString(),
    updatedAt: os.updatedAt.toISOString(),
  };

  return (
    <ServiceOrderEditor
      initial={editable}
      settings={{
        companyName: settings.companyName,
        legalName: settings.legalName,
        tagline: settings.tagline,
        director: settings.director,
        role: settings.role,
        phone: settings.phone,
        landline: settings.landline,
        email: settings.email,
        site: settings.site,
        address: settings.address,
        cnpj: settings.cnpj,
        crea: settings.crea,
        hours: settings.hours,
      }}
    />
  );
}
