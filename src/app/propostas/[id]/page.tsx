import { notFound } from "next/navigation";
import {
  ensureBootstrap,
  getSettings,
  listActivities,
  listCatalog,
  listRevisions,
  proposalWithClient,
} from "@/lib/data";
import { ProposalEditor, type EditorActivity } from "@/components/proposal/ProposalEditor";
import { isProposalType, type ProposalType } from "@/lib/proposal/types";

export const dynamic = "force-dynamic";

export default async function ProposalEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await ensureBootstrap();
  const { id } = await params;
  const result = await proposalWithClient(id);
  if (!result) notFound();
  const [settings, catalog] = await Promise.all([getSettings(), listCatalog()]);
  const { proposal } = result;
  const activities: EditorActivity[] = (await listActivities(id)).map((a) => ({
    id: a.id,
    kind: a.kind,
    content: a.content,
    dueAt: a.dueAt ? a.dueAt.toISOString() : null,
    doneAt: a.doneAt ? a.doneAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  }));
  const revisions = await listRevisions(id);

  return (
    <ProposalEditor
      initial={{
        id: proposal.id,
        number: proposal.number,
        type: isProposalType(proposal.type) ? (proposal.type as ProposalType) : "completa",
        status: proposal.status,
        archived: proposal.archived,
        revision: proposal.revision,
        revisionGroupId: proposal.revisionGroupId,
        clientName: proposal.clientName,
        contact: proposal.contact,
        clientEmail: proposal.clientEmail,
        site: proposal.site,
        issuedAt: proposal.issuedAt.toISOString(),
        validityDays: proposal.validityDays,
        discountPct: proposal.discountPct,
        items: proposal.items,
        sections: proposal.sections,
        paymentTerms: proposal.paymentTerms,
        deliveryTime: proposal.deliveryTime,
        warranty: proposal.warranty,
        artIncluded: proposal.artIncluded,
        nextActionAt: proposal.nextActionAt ? proposal.nextActionAt.toISOString() : null,
        nextActionNote: proposal.nextActionNote,
        lossReason: proposal.lossReason,
        briefing: proposal.briefing,
      }}
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
      catalog={catalog.map((c) => ({
        id: c.id,
        kind: c.kind,
        category: c.category,
        description: c.description,
        spec: c.spec,
        unit: c.unit,
        priceCents: c.priceCents,
      }))}
      activities={activities}
      revisions={revisions.map((r) => ({
        id: r.id,
        number: r.number,
        revision: r.revision,
        status: r.status,
        totalCents: r.totalCents,
        createdAt: r.createdAt.toISOString(),
        issuedAt: r.issuedAt.toISOString(),
      }))}
    />
  );
}
