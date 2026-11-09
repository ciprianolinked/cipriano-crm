import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { CondominiumsManager } from "@/components/CondominiumsManager";
import { listCondominiums, listQuotations } from "@/lib/server/quotations";
import type { CondominiumRecord } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Condomínios · Gerencial" };

export default async function CondominiosPage() {
  let initial: Array<CondominiumRecord & { mapCount: number }> = [];
  let dbError = false;
  try {
    const [condominiums, quotations] = await Promise.all([listCondominiums(), listQuotations()]);
    initial = condominiums.map((condominium) => ({
      ...condominium,
      mapCount: quotations.filter((quotation) => quotation.condominium === condominium.name).length,
    }));
  } catch {
    dbError = true;
  }
  return <AppShell><CondominiumsManager initial={initial} dbError={dbError} /></AppShell>;
}
