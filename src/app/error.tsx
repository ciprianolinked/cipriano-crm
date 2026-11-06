"use client";

import Link from "next/link";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-10">
      <section className="card w-full p-6">
        <div className="label-mono text-alarm">Erro no servidor</div>
        <h1 className="mt-2 font-display text-2xl font-semibold text-white">A página não conseguiu carregar</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-steel">
          Na Vercel, essa tela quase sempre indica que o Neon ainda não está ligado ao app: falta a variável do banco,
          a conexão SSL foi recusada ou as tabelas ainda não foram criadas.
        </p>
        <ol className="mt-4 space-y-2 text-[12.5px] leading-relaxed text-silver">
          <li>1. Em Vercel → Settings → Environment Variables, cadastre <b>DATABASE_URL</b> com a string do Neon que contém <b>-pooler</b> e <b>sslmode=require</b>.</li>
          <li>2. Faça <b>Redeploy</b>. Variável adicionada depois do deploy não entra sozinha.</li>
          <li>3. No Neon → SQL Editor, execute o script completo do guia de publicação.</li>
          <li>4. Abra <b>/api/health</b>. A resposta precisa ser <b>{`{ "ok": true }`}</b>.</li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="btn btn-primary">Tentar novamente</button>
          <Link href="/guia-publicacao" className="btn">Abrir guia e copiar o SQL</Link>
        </div>
      </section>
    </div>
  );
}
