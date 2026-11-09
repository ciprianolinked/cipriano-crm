import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { IndicatorsDashboard } from "@/components/IndicatorsDashboard";
import { listPdfExports } from "@/lib/server/downloads";
import { listCondominiums, listQuotations } from "@/lib/server/quotations";
import type { PdfExportRecord } from "@/lib/server/downloads";
import type { QuotationRecord } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Indicadores para assembleia · Gerencial" };

export default async function IndicatorsPage({ searchParams }: { searchParams: Promise<{ condominio?: string }> }) {
  const { condominio } = await searchParams;
  let records: QuotationRecord[] = [];
  let condominiums: string[] = [];
  let downloads: PdfExportRecord[] = [];
  let dbError = false;

  // Os mapas e condomínios são a base dos indicadores. O histórico de PDFs é
  // complementar: uma falha nele não pode apagar o dashboard inteiro.
  try {
    const [quotations, condos] = await Promise.all([listQuotations(), listCondominiums()]);
    records = quotations;
    condominiums = condos.map((item) => item.name);
  } catch {
    dbError = true;
  }

  try {
    downloads = await listPdfExports(10);
  } catch {
    downloads = [];
  }

  return (
    <AppShell>
      <IndicatorsDashboard
        records={records}
        condominiums={condominiums}
        initialCondominium={condominio}
        initialDownloads={downloads}
        dbError={dbError}
      />
    </AppShell>
  );
}
