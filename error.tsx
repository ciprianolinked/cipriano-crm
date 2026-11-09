"use client";

import Link from "next/link";
import { CircleAlert, RefreshCw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto flex min-h-[65vh] max-w-[760px] flex-col justify-center px-5 py-12"><div className="card p-7"><CircleAlert size={28} className="text-amber" /><div className="label-mono mt-5 text-signal">Não foi possível carregar</div><h1 className="mt-2 font-display text-2xl font-semibold text-white">Vamos tentar novamente?</h1><p className="mt-3 text-[13px] leading-relaxed text-steel">Se você acabou de publicar o site, confira a conexão DATABASE_URL e a estrutura do banco no Neon. Depois de alterar variáveis na Vercel, é necessário publicar um novo deployment.</p><div className="mt-6 flex flex-wrap gap-3"><button className="btn btn-primary" onClick={reset}><RefreshCw size={15} />Tentar novamente</button><Link href="/diagnostico" className="btn">Verificar conexão</Link><Link href="/guia-publicacao#banco-neon-sql" className="btn">Guia e SQL do banco</Link></div><p className="mt-5 text-[11px] text-steel">Esta tela não apaga seus dados. Detalhes do erro ficam nos logs do servidor.</p></div></div>;
}
