import { AppShell } from "@/components/AppShell";
import { NewQuotationView } from "@/components/NewQuotationView";
import { listCondominiums } from "@/lib/server/quotations";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage() {
  let condominiums: string[] = [];
  try {
    condominiums = (await listCondominiums()).map((condominium) => condominium.name);
  } catch {
    condominiums = [];
  }

  return (
    <AppShell>
      <NewQuotationView condominiums={condominiums} />
    </AppShell>
  );
}
