"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/ui/Logo";

const NAV = [
  { href: "/", label: "Painel comercial", icon: "◧", hint: "Visão do dia" },
  { href: "/propostas/nova", label: "Nova proposta", icon: "＋", hint: "Briefing em 60s" },
  { href: "/propostas", label: "Propostas", icon: "▤", hint: "Documentos e PDF" },
  { href: "/contratos", label: "Contratos", icon: "▱", hint: "Formalização opcional" },
  { href: "/crm", label: "CRM · Kanban", icon: "◫", hint: "Funil e follow-ups" },
  { href: "/clientes", label: "Clientes", icon: "◇", hint: "Base comercial" },
  { href: "/catalogo", label: "Catálogo", icon: "▦", hint: "Itens e preços" },
  { href: "/manutencao", label: "Manutenção", icon: "↻", hint: "Contratos & reajustes" },
  { href: "/configuracoes", label: "Identidade", icon: "◎", hint: "Timbrado e padrões" },
];

export function SideNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="no-print sticky top-0 z-40 flex items-center justify-between border-b border-line/70 bg-abyss/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo height={22} />
          <span className="font-display text-sm font-semibold tracking-tight text-white">Cipriano</span>
          <span className="font-mono text-[9px] tracking-[0.2em] text-signal">T&S</span>
        </Link>
        <button onClick={() => setOpen((v) => !v)} className="btn px-3 py-1.5" aria-label="Menu">
          {open ? "Fechar" : "Menu"}
        </button>
      </div>

      <aside
        className={`no-print ${
          open ? "block" : "hidden"
        } sticky top-0 z-30 w-full shrink-0 border-r border-line/60 bg-abyss2/80 px-3 py-4 backdrop-blur lg:block lg:h-screen lg:w-[248px] lg:px-4 lg:py-6`}
      >
        <Link href="/" className="mb-7 hidden items-center gap-2.5 px-1 lg:flex" onClick={() => setOpen(false)}>
          <Logo height={46} />
        </Link>

        <nav className="space-y-1">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition ${
                  active
                    ? "border-signal/35 bg-signal/10 text-white"
                    : "border-transparent text-silver/85 hover:border-line hover:bg-navy2/60 hover:text-white"
                }`}
              >
                <span className={`font-mono text-[13px] ${active ? "text-signal" : "text-steel"}`}>{item.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium leading-tight">{item.label}</span>
                  <span className="block truncate font-mono text-[8.5px] uppercase tracking-[0.16em] text-steel">
                    {item.hint}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 hidden rounded-xl border border-line/60 bg-navy/40 p-3 lg:block">
          <div className="label-mono text-signal">Setup comercial</div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-steel">
            Padrão Cipriano: validade de 15 dias, follow-up em D+2 e proposta completa acima de R$ 3.000.
          </p>
          <Link href="/propostas/nova" className="btn btn-primary mt-3 w-full text-[12px]">
            Gerar proposta
          </Link>
        </div>

        <div className="mt-6 hidden text-[10px] leading-relaxed text-steel/70 lg:block">
          <div className="font-mono uppercase tracking-[0.18em]">Gabriel Cipriano</div>
          <div>Diretor Técnico · CREA-SP</div>
        </div>
      </aside>
    </>
  );
}
