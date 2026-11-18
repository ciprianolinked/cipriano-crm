import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deliveryTerms, proposals } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import { ensureBootstrap, getSettings } from "@/lib/data";
import { DeliveryTermEditor, type EditableTerm } from "@/components/delivery/DeliveryTermEditor";
import { loadDatabasePage } from "@/components/system/load-database-page";

export const dynamic = "force-dynamic";

export default async function TermoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadDatabasePage(async () => {
    await ensureSchema();
    await ensureBootstrap();
    const [term] = await db.select().from(deliveryTerms).where(eq(deliveryTerms.id, id)).limit(1);
    if (!term) notFound();
    const settings = await getSettings();
    let proposalNumber: string | null = null;
    if (term.proposalId) {
      const [p] = await db.select({ number: proposals.number }).from(proposals).where(eq(proposals.id, term.proposalId)).limit(1);
      proposalNumber = p?.number ?? null;
    }
    return { term, settings, proposalNumber };
  });
  if (!loaded.ok) return loaded.recovery;
  const { term, settings, proposalNumber } = loaded.data;

  const editable: EditableTerm = {
    id: term.id,
    proposalId: term.proposalId,
    termNumber: term.termNumber,
    proposalNumber,
    clientName: term.clientName,
    site: term.site,
    deliveryDate: term.deliveryDate ? term.deliveryDate.toISOString() : null,
    technician: term.technician,
    receiverName: term.receiverName,
    receiverDoc: term.receiverDoc,
    items: term.items,
    intro: term.intro,
    scopeSummary: term.scopeSummary,
    tests: term.tests,
    pendencies: term.pendencies,
    warranty: term.warranty,
    observations: term.observations,
    status: term.status,
    createdAt: term.createdAt.toISOString(),
    updatedAt: term.updatedAt.toISOString(),
  };

  return (
    <DeliveryTermEditor
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
      aiEnabled={Boolean(process.env.OPENAI_API_KEY)}
    />
  );
}
