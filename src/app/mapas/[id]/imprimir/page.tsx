import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapDocument } from "@/components/MapDocument";
import { PrintToolbar } from "@/components/PrintToolbar";
import { getQuotation } from "@/lib/server/quotations";
import type { QuotationDraft } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mapa de Cotação · Gerencial",
};

export default async function PrintQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getQuotation(id).catch(() => null);
  if (!record) notFound();

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
    <div className="print-page min-h-screen bg-paper pb-10">
      <PrintToolbar quotationId={record.id} protocol={record.protocol} />
      <div className="mx-auto max-w-[1000px] px-3 py-5 sm:px-6 print:p-0">
        <MapDocument draft={draft} protocol={record.protocol} />
      </div>
    </div>
  );
}
