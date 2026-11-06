import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { brand } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="no-print mt-6 border-t border-line/60 bg-abyss2/70">
      <div className="mx-auto max-w-[1500px] px-4 py-5 lg:px-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <Logo height={40} />
            <div className="mt-1 hidden text-[10px] leading-relaxed text-steel sm:block">
              <div className="font-mono uppercase tracking-[0.16em] text-silver">Painel comercial</div>
              <div>Propostas · CRM · Catálogo</div>
            </div>
          </div>

          <nav className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11.5px] text-steel">
            <Link href="/" className="hover:text-signal">
              Painel
            </Link>
            <Link href="/propostas" className="hover:text-signal">
              Propostas
            </Link>
            <Link href="/crm" className="hover:text-signal">
              CRM
            </Link>
            <Link href="/catalogo" className="hover:text-signal">
              Catálogo
            </Link>
            <Link href="/configuracoes" className="hover:text-signal">
              Identidade
            </Link>
          </nav>
        </div>

        <Link
          href="/guia-publicacao"
          className="group mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-signal/35 bg-signal/8 px-4 py-3 transition hover:border-signal/70 hover:bg-signal/12"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-signal/40 bg-abyss text-[15px] text-signal">
              ↗
            </span>
            <div>
              <div className="font-display text-[13.5px] font-semibold text-white">
                Guia de publicação do site completo
              </div>
              <div className="text-[11px] text-steel">
                Passo a passo com GitHub, Vercel e Neon.tech — do repositório ao domínio próprio.
              </div>
            </div>
          </div>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-signal group-hover:underline">
            abrir guia →
          </span>
        </Link>

        <div className="mt-4 flex flex-col gap-1 border-t border-line/40 pt-3 text-[10px] leading-relaxed text-steel/80 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {brand.legalName} · CNPJ {brand.cnpj} · {brand.crea}
          </span>
          <span>
            {brand.phone} · {brand.email} · {brand.site}
          </span>
        </div>
      </div>
    </footer>
  );
}
