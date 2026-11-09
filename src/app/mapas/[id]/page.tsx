import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { QuotationEditor } from "@/components/QuotationEditor";
import { getQuotation, listCondominiums } from "@/lib/server/quotations";
import type { QuotationDraft } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mapa de cotação · Gerencial",
};

export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getQuotation(id).catch(() => null);
  if (!record) notFound();

  let condominiums: string[] = [];
  try {
    condominiums = (await listCondominiums()).map((condominium) => condominium.name);
  } catch {
    condominiums = [];
  }
  if (record.condominium && !condominiums.includes(record.condominium)) {
    condominiums = [...condominiums, record.condominium];
  }

  const draft: QuotationDraft = {
    status: record.status,
    condominium: record.condominium,
    analysisDate: record.analysisDate,
    recipient: record.recipient,
    service: record.service,
    description: record.description,
    kind: record.kind,
    category: record.category,
    suppliers: record.suppliers,
    items: record.items,
    analysis: record.analysis,
    attachments: record.attachments,
  };

  return (
    <AppShell>
      <QuotationEditor
        initial={draft}
        quotationId={record.id}
        protocol={record.protocol}
        condominiums={condominiums}
      />
    </AppShell>
  );
}
