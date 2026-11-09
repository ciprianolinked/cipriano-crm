import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { ArrowLeftIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <BrandLogo size="lg" />
        </div>
        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-dark">Página não encontrada</p>
        <h1 className="font-display mt-1 text-[28px] leading-tight text-ink">Este mapa não está disponível</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
          O documento pode ter sido excluído ou o endereço está incorreto. Volte ao painel para consultar os mapas de
          cotação do portfólio.
        </p>
        <Link href="/" className="btn btn-primary mt-5">
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar ao painel
        </Link>
      </div>
    </main>
  );
}
