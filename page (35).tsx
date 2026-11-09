import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ensureBootstrap } from "@/lib/data";
import { getMaintenanceData, listRecentReadjusts } from "@/lib/maintenance-db";
import { MaintenanceManager } from "@/components/maintenance/MaintenanceManager";
import { loadDatabasePage } from "@/components/system/load-database-page";

export const dynamic = "force-dynamic";

export default async function ManutencaoPage() {
  const loaded = await loadDatabasePage(async () => {
    await ensureBootstrap();
    const [data, recentReadjusts] = await Promise.all([getMaintenanceData(), listRecentReadjusts(12)]);
    return { data, recentReadjusts };
  });
  if (!loaded.ok) return loaded.recovery;
  const { data, recentReadjusts } = loaded.data;
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-steel"><Link href="/crm" className="hover:text-signal">CRM</Link><span className="text-line">/</span><span className="text-signal">Manutenção mensal</span></div>
      <header className="relative overflow-hidden rounded-2xl border border-line/60 bg-gradient-to-r from-[#0b2038] via-[#0c1d32] to-[#071523] px-5 py-6 sm:px-7 sm:py-7">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-signal/[0.05] blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div><div className="mb-2 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-signal"><span className="h-1.5 w-1.5 rounded-full bg-armed"/> Receita recorrente</div><h1 className="font-display text-[clamp(1.65rem,3vw,2.2rem)] font-semibold leading-tight tracking-tight text-white">Manutenção &amp; contratos</h1><p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-steel">Transforme propostas em contratos de manutenção, acompanhe mensalidades e escolha o reajuste com segurança.</p></div>
          <Link href="/manutencao/novo" className="btn btn-primary"><Sparkles size={15}/> Criar contrato <ArrowRight size={14}/></Link>
        </div>
      </header>
      <div className="mt-5"><MaintenanceManager contracts={data.contracts} observations={data.observations} comparison={data.comparison} recentReadjusts={recentReadjusts}/></div>
    </div>
  );
}
