import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { deliveryTerms } from "@/db/schema";
import { fmtDate } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function DeliveryTermsPage() {
  const rows = await db.select().from(deliveryTerms).orderBy(desc(deliveryTerms.createdAt));
  return (
    <div className="mx-auto max-w-6xl px-4 py-7 lg:px-7">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line/50 pb-4">
        <div><div className="label-mono text-signal">Entrega e aceite técnico</div><h1 className="mt-1 font-display text-2xl font-semibold text-white">Termos de entrega</h1><p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-steel">Gere um documento vinculado à proposta ganha, confira os itens e as ressalvas, edite o texto e imprima para assinatura.</p></div>
        <Link href="/termos-entrega/novo" className="btn btn-primary">Novo termo</Link>
      </header>
      <section className="card p-5">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="data">
              <thead><tr><th>Número</th><th>Cliente</th><th>Proposta</th><th>Data</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-mono text-signal"><Link href={`/termos-entrega/${row.id}`}>{row.number}</Link></td>
                    <td><Link href={`/termos-entrega/${row.id}`} className="text-white hover:text-signal">{row.clientName}</Link><div className="text-[10px] text-steel">{row.title}</div></td>
                    <td className="font-mono text-[10px] text-steel">{row.proposalNumber} · R{row.proposalRevision}</td>
                    <td>{fmtDate(new Date(`${row.deliveryDate}T12:00:00`))}</td>
                    <td><span className="chip">{row.status}</span></td>
                    <td><Link className="btn py-1 text-[10px]" href={`/termos-entrega/${row.id}`}>Abrir / editar</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line/60 p-7 text-center text-sm text-steel">Nenhum termo criado. Marque uma proposta como ganha e use “Elaborar termo de entrega”, ou comece em “Novo termo”.</p>
        )}
      </section>
    </div>
  );
}
