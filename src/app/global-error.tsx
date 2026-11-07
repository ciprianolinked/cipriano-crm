"use client";

import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="pt-BR"><body><main className="grid min-h-screen place-items-center bg-abyss px-5 py-12"><section className="card w-full max-w-xl p-8"><div className="label-mono text-signal">Cipriano Tech &amp; Security</div><h1 className="mt-3 font-display text-2xl font-semibold text-white">O aplicativo não pôde iniciar</h1><p className="mt-3 text-sm leading-relaxed text-steel">Confira a configuração do banco e os Runtime Logs do deployment na Vercel. O guia de publicação continua disponível mesmo sem o banco configurado.</p><div className="mt-6 flex flex-wrap gap-3"><button className="btn btn-primary" onClick={reset}>Tentar novamente</button><a className="btn" href="/guia-publicacao">Guia de publicação</a><a className="btn" href="/diagnostico">Diagnóstico</a></div></section></main></body></html>;
}
