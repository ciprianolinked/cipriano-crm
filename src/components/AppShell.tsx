import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";
import { PlusIcon, SparklesIcon } from "./icons";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="no-print sticky top-0 z-40 bg-ink text-white shadow-[0_2px_0_0_#fab12a]">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label="Gerencial — início"
            >
              <BrandLogo size="sm" treatment="bare" />
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              <Link
                href="/"
                className="rounded-lg px-3 py-2 text-[13px] font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                Painel
              </Link>
              <Link
                href="/#mapas"
                className="rounded-lg px-3 py-2 text-[13px] font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                Mapas de cotação
              </Link>
              <Link
                href="/condominios"
                className="rounded-lg px-3 py-2 text-[13px] font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                Condomínios
              </Link>
              <Link
                href="/indicadores"
                className="rounded-lg px-3 py-2 text-[13px] font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                Indicadores
              </Link>
              <Link
                href="/configuracoes"
                className="rounded-lg px-3 py-2 text-[13px] font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                Configurar IA
              </Link>
              <Link
                href="/ajuda"
                className="rounded-lg px-3 py-2 text-[13px] font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                Ajuda
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/ajuda" className="rounded-lg px-2 py-2 text-[12px] font-semibold text-white/80 hover:bg-white/10 md:hidden">
              Ajuda
            </Link>
            <Link
              href="/ajuda/ia"
              className="hidden items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand transition hover:bg-white/15 lg:inline-flex"
            >
              <SparklesIcon className="h-3 w-3" />
              IA gratuita
            </Link>
            <Link href="/mapas/novo" className="btn btn-brand">
              <PlusIcon />
              <span className="hidden sm:inline">Nova cotação</span>
              <span className="sm:hidden">Nova</span>
            </Link>
          </div>
        </div>
        <nav aria-label="Navegação móvel" className="flex gap-4 overflow-x-auto border-t border-white/10 px-4 pb-2 pt-1.5 text-[11px] font-semibold text-white/75 md:hidden">
          <Link href="/" className="whitespace-nowrap">Painel</Link>
          <Link href="/condominios" className="whitespace-nowrap">Condomínios</Link>
          <Link href="/indicadores" className="whitespace-nowrap">Indicadores</Link>
          <Link href="/configuracoes" className="whitespace-nowrap">Configurar IA</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
