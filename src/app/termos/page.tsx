import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { deliveryTerms } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import { ensureBootstrap } from "@/lib/data";
import { fmtDate } from "@/lib/brand";
import { loadDatabasePage } from "@/components/system/load-database-page";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "!border-line/60 !text-steel" },
  pronto: { label: "Pronto p/ assinatura", cls: "!border-amber/50 !text-amber" },
  assinado: { label: "Assinado", cls: "!border-armed/50 !text-armed" },
};

export default async function TermosPage() {
  const loaded = await loadDatabasePage(async () => {
    await ensureSchema();
    await ensureBootstrap();
    return db.select().from(deliveryTerms).orderBy(desc(deliveryTerms.createdAt));
  });
  if (!loaded.ok) return loaded.recovery;
  const terms = loaded.data;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5 lg:px-7 lg:py-7">
      <header className="border-b border-line/50 pb-4">
        <div className="label-mono text-signal">Pós-obra · comissionamento</div>
        <h1 className="mt-2 font-display text-[clamp(1.5rem,2.6vw,2rem)] font-semibold text-white">
          Termos de entrega
        </h1>
        <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-steel">
          Formalize a entrega técnica de cada proposta ganha: checklist de itens, testes executados,
          garantia e assinaturas. Para gerar um novo termo, abra a proposta e clique em “Termo de entrega”.
        </p>
      </header>

      {terms.length === 0 ? (
        <div className="card mt-4 p-6 text-center">
          <p className="text-[13px] text-silver">Nenhum termo de entrega elaborado.</p>
          <p className="mt-1 text-[11.5px] text-steel">
            Abra uma proposta ganha em <Link href="/propostas" className="text-signal hover:underline">Propostas</Link> e
            clique em “Termo de entrega”.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-line/60">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-line/50 bg-abyss2/60 font-mono text-[9px] uppercase tracking-[0.16em] text-steel">
                <th className="px-3 py-2.5">Termo</th>
                <th className="px-3 py-2.5">Cliente</th>
                <th className="px-3 py-2.5">Entrega</th>
                <th className="px-3 py-2.5">Checklist</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => {
                const st = STATUS[t.status] ?? STATUS.rascunho;
                const checked = t.items.filter((i) => i.checked).length;
                return (
                  <tr key={t.id} className="border-b border-line/40 transition hover:bg-navy2/50">
                    <td className="px-3 py-2.5">
                      <Link href={`/termos/${t.id}`} className="font-mono text-[11.5px] text-signal hover:underline">
                        {t.termNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-silver">{t.clientName}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-steel">{fmtDate(t.deliveryDate)}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-steel">
                      {checked}/{t.items.length}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`chip ${st.cls}`}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
