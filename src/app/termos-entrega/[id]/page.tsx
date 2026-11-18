import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deliveryTerms, proposals } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { DeliveryTermWorkspace } from "@/components/delivery-term/DeliveryTermWorkspace";

export const dynamic = "force-dynamic";

export default async function DeliveryTermPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(deliveryTerms).where(eq(deliveryTerms.id, id)).limit(1);
  const term = rows[0];
  if (!term) notFound();
  const [settingsRows, proposalRows] = await Promise.all([
    getSettings(),
    term.proposalId ? db.select().from(proposals).where(eq(proposals.id, term.proposalId)).limit(1) : Promise.resolve([]),
  ]);
  const proposal = proposalRows[0];
  return <DeliveryTermWorkspace
    initialTerm={{
      id: term.id,
      number: term.number,
      proposalId: term.proposalId ?? "",
      proposalNumber: term.proposalNumber,
      proposalRevision: term.proposalRevision,
      clientId: term.clientId,
      clientName: term.clientName,
      contact: term.contact ?? "",
      clientEmail: term.clientEmail ?? "",
      site: term.site ?? "",
      title: term.title,
      deliveryDate: term.deliveryDate,
      status: term.status === "entregue" || term.status === "aceito" ? term.status : "rascunho",
      items: term.items,
      sections: term.sections,
      generatedByAi: term.generatedByAi,
    }}
    proposal={{
      id: term.proposalId ?? "",
      number: term.proposalNumber,
      revision: term.proposalRevision,
      status: proposal?.status ?? "ganho",
      clientName: term.clientName,
      contact: term.contact,
      clientEmail: term.clientEmail,
      site: term.site,
      warranty: proposal?.warranty ?? null,
      deliveryTime: proposal?.deliveryTime ?? null,
      items: term.items,
    }}
    settings={{ companyName: settingsRows.companyName, legalName: settingsRows.legalName, cnpj: settingsRows.cnpj, crea: settingsRows.crea, address: settingsRows.address, phone: settingsRows.phone, email: settingsRows.email }}
  />;
}
