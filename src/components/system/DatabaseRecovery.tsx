import Link from "next/link";
import { ArrowRight, BookOpen, Download, Database } from "lucide-react";
import { getDatabaseDiagnostics, type DatabaseDiagnostics } from "@/lib/database-diagnostics";
import { DatabaseStatusPanel } from "@/components/system/DatabaseStatusPanel";

export async function DatabaseRecovery({ diagnostics }: { diagnostics?: DatabaseDiagnostics }) {
  const report = diagnostics ?? await getDatabaseDiagnostics();
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 lg:px-8 lg:py-12">
      <div className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-signal"><Database size={14} />Configuração do aplicativo</div>
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.5rem)] font-semibold tracking-tight text-white">Vamos reconectar seu painel</h1>
      <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-steel">O aplicativo precisa acessar o banco de dados para mostrar propostas, CRM e contratos. Siga os passos abaixo no mesmo projeto publicado na Vercel. Esta tela não apaga seus dados.</p>
      <div className="mt-6"><DatabaseStatusPanel initial={report} /></div>
      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <Step number="01" title="Configure a conexão" text="Na Vercel, adicione DATABASE_URL com a string do Neon em Production. Use o host com -pooler." />
        <Step number="02" title="Prepare o Neon" text="No SQL Editor, selecione o mesmo branch e database da conexão. Execute o SQL completo do guia." />
        <Step number="03" title="Publique novamente" text="Salvar a variável não altera o deployment atual. Faça um novo deploy e volte para verificar a conexão." />
      </section>
      <div className="mt-6 flex flex-wrap gap-3"><Link href="/guia-publicacao#banco-neon-sql" className="btn btn-primary"><BookOpen size={15} />Abrir guia e copiar SQL<ArrowRight size={14} /></Link><a href="/neon-setup.sql" download className="btn"><Download size={15} />Baixar neon-setup.sql</a><Link href="/diagnostico" className="btn">Diagnóstico completo</Link></div>
      <p className="mt-4 text-[11px] leading-relaxed text-steel">Já configurou tudo? Aguarde o novo deployment ficar ativo e clique em “Verificar conexão”. Se o erro continuar, consulte os Runtime Logs na Vercel.</p>
    </div>
  );
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="card p-4"><span className="font-mono text-[10px] text-signal">{number}</span><h2 className="mt-2 font-display text-[14px] font-semibold text-white">{title}</h2><p className="mt-2 text-[11.5px] leading-relaxed text-steel">{text}</p></div>;
}
