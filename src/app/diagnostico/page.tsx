import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, BookOpen, Download } from "lucide-react";
import { DatabaseStatusPanel } from "@/components/system/DatabaseStatusPanel";

export const metadata: Metadata = { title: "Diagnóstico de conexão | Cipriano Tech & Security", robots: { index: false, follow: false } };

export default function DiagnosticsPage() {
  return <div className="mx-auto max-w-[1000px] px-4 py-8 lg:px-8"><Link href="/" className="inline-flex items-center gap-2 text-[12px] text-steel hover:text-signal"><ArrowLeft size={14} />Voltar ao painel</Link><div className="mb-6 mt-6"><div className="label-mono text-signal">Publicação e banco de dados</div><h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">Diagnóstico do aplicativo</h1><p className="mt-2 text-[13px] leading-relaxed text-steel">Verifique a conexão deste deployment com o PostgreSQL. Esta página funciona mesmo antes de configurar o banco.</p></div><DatabaseStatusPanel /><div className="mt-5 flex flex-wrap gap-3"><Link href="/guia-publicacao#banco-neon-sql" className="btn btn-primary"><BookOpen size={15} />Guia de publicação e SQL</Link><a href="/neon-setup.sql" download className="btn"><Download size={15} />Baixar SQL do Neon</a></div></div>;
}
