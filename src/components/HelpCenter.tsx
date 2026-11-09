"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRightIcon,
  BuildingIcon,
  CheckIcon,
  FileIcon,
  PlusIcon,
  PrinterIcon,
  SearchIcon,
  SparklesIcon,
  TrendIcon,
} from "./icons";

type Category = "todos" | "inicio" | "ia" | "comparar" | "salvar";

type Topic = {
  id: string;
  category: Exclude<Category, "todos">;
  label: string;
  title: string;
  description: string;
  steps: string[];
  tip?: string;
  keywords: string;
};

type Question = {
  category: Exclude<Category, "todos">;
  question: string;
  answer: string;
  keywords: string;
};

const FILTERS: { id: Category; label: string }[] = [
  { id: "todos", label: "Todos os assuntos" },
  { id: "inicio", label: "Primeiros passos" },
  { id: "ia", label: "Leitura com IA" },
  { id: "comparar", label: "Comparativo" },
  { id: "salvar", label: "Salvar e imprimir" },
];

const TOPICS: Topic[] = [
  {
    id: "criar-mapa", category: "inicio", label: "Primeiros passos", title: "Criar um novo mapa de cotação",
    description: "Comece uma cotação de serviço ou uma lista de produtos para qualquer condomínio ou associação.",
    steps: [
      "No topo da página, clique em “Nova cotação”.",
      "Informe o condomínio, a data de análise, o serviço ou objeto e a pessoa a quem o mapa será encaminhado (A/C).",
      "Escolha “Serviço” ou “Produtos”, a categoria e, se quiser, descreva o escopo. Todos os campos podem ser editados depois.",
      "Escolha analisar as propostas com IA ou clique em “Criar mapa em branco” para preencher manualmente.",
    ],
    tip: "Para salvar, é necessário informar o condomínio ou associação. A data começa preenchida com o dia atual e pode ser alterada.",
    keywords: "novo criar mapa associacao condominio data cabecalho servico produtos vazio manual",
  },
  {
    id: "condominios", category: "inicio", label: "Cadastro", title: "Cadastrar e editar condomínios",
    description: "Mantenha os dados dos condomínios e associações organizados em um só lugar.",
    steps: [
      "No menu, clique em “Condomínios” para consultar a lista cadastrada.",
      "Clique em “Cadastrar condomínio” para adicionar o nome, cidade, responsável e e-mail.",
      "Para atualizar um cadastro, clique em “Editar”, ajuste os campos e salve. Alterações de nome também atualizam os mapas vinculados.",
    ],
    tip: "Cadastros com mapas vinculados não podem ser excluídos enquanto houver mapas associados.",
    keywords: "condominio cadastro associacao editar renomear adicionar cidade sindico email",
  },
  {
    id: "analisar-ia", category: "ia", label: "Leitura com IA", title: "Analisar propostas com inteligência artificial",
    description: "Envie as propostas dos fornecedores juntas para montar um único comparativo.",
    steps: [
      "Na tela de nova cotação, selecione ou arraste os arquivos PDF, JPG, PNG ou WEBP para a área de envio.",
      "Selecione até 6 arquivos. Se o site estiver na Vercel, mantenha o total do envio abaixo de 4 MB, somando todos eles.",
      "Clique em “Analisar propostas e gerar mapa” e aguarde a resposta. A porcentagem exibida é uma estimativa.",
      "Ao terminar, clique em “Aplicar dados ao mapa”. Confira os fornecedores, itens, quantidades, preços e condições antes de salvar.",
      "Em um mapa já preenchido, escolha “Completar o mapa atual” para somar um arquivo recebido depois. Os preços já lançados são preservados e apenas as lacunas são preenchidas.",
      "Se a leitura vier incompleta, use “Reanalisar cotação completa” na lateral: os mesmos arquivos são enviados de novo, sem precisar reanexar. Depois use “Verificar preenchimento” para listar o que ainda falta.",
    ],
    tip: "O aplicativo guarda os dados extraídos, não os arquivos originais. Para somar um novo documento, envie-o novamente junto nesta análise e mantenha a opção “Completar o mapa atual”.",
    keywords: "anexo arquivo foto upload tres propostas pdf jpg jpeg webp png enviar aplicar dados progresso gemini",
  },
  {
    id: "pesquisa-online", category: "ia", label: "Pesquisa online", title: "Pesquisar produto e link de compra",
    description: "A IA pode procurar o produto em lojas confiáveis e trazer um link de compra.",
    steps: [
      "Antes de analisar, marque “Pesquisar produtos e links de compra em lojas confiáveis”. A opção é gratuita e pode ser desmarcada.",
      "A busca usa o Google restrito a uma lista de lojas conhecidas (Leroy Merlin, Telhanorte, Sodimac, Obramax, Amazon, Magalu e outras).",
      "Depois de aplicar a análise, confira em “Links de compra dos produtos” o link, a loja e o preço encontrados. O selo “Loja confiável” indica que o endereço pertence à lista.",
      "Em um mapa já pronto, use o botão “Pesquisar online” nessa mesma área para buscar apenas os itens que estão sem link.",
      "Para cadastrar manualmente, cole o endereço completo (https://…) no campo do item. Links fora da lista são aceitos, mas não recebem o selo de confiável.",
    ],
    tip: "A IA copia o endereço completo da página do produto (nunca só o domínio) e nunca inventa links. Links de lojas fora da lista aparecem sem o selo de confiável. Sempre confira o anúncio, o preço e o prazo antes de comprar.",
    keywords: "pesquisa online link compra produto loja confiavel url preço google search mercado livre leroy telhanorte",
  },
  {
    id: "manual", category: "comparar", label: "Comparativo", title: "Preencher fornecedores e itens manualmente",
    description: "Use esta opção quando preferir montar o mapa sem leitura automática.",
    steps: [
      "Na nova cotação, clique em “Criar mapa em branco”.",
      "Na seção “Fornecedores consultados”, substitua os nomes de exemplo pelos fornecedores reais e registre prazo, pagamento, validade e contato. É possível cadastrar até 5 fornecedores.",
      "Em “Itens, serviços e valores”, adicione uma linha por item, informe a quantidade e a unidade.",
      "Em cada item, selecione “Mão de obra”, “Material” ou “Não discriminado”. Preencha o valor unitário de cada fornecedor; se não foi cotado, deixe em branco.",
    ],
    tip: "Para uma lista de materiais elétricos, hidráulicos ou de piscina, selecione “Produtos” no campo de natureza.",
    keywords: "digitar manual fornecedor quantidade unidade produto servico tabela valor preco condicoes",
  },
  {
    id: "entender-valores", category: "comparar", label: "Comparativo", title: "Entender totais e economia",
    description: "Saiba o que os destaques e os cálculos significam antes de decidir.",
    steps: [
      "O total de cada linha é calculado pela quantidade multiplicada pelo preço unitário informado.",
      "O verde destaca o menor preço unitário disponível para cada item. Ele não substitui a análise das demais condições da proposta.",
      "A melhor proposta e a economia global consideram fornecedores com preços preenchidos para todos os itens do mapa.",
      "Confira os subtotais de mão de obra, material e não discriminado por fornecedor. Compare também escopo, prazos, garantia, impostos e pagamento.",
    ],
    tip: "Um valor em branco não é zero. Se um fornecedor não cotou todos os itens, seu total é parcial e precisa de conferência.",
    keywords: "economia calculo menor preco verde total percentual resultado parcial cobertura comparacao",
  },
  {
    id: "parecer", category: "comparar", label: "Análise", title: "Revisar o parecer e a recomendação",
    description: "O resumo e a recomendação são editáveis e devem ser revisados pela equipe.",
    steps: [
      "Na seção “Análise técnica e recomendação”, leia o resumo comparativo e a recomendação gerados.",
      "Edite os textos para incluir as condições, ressalvas e informações relevantes ao condomínio.",
      "Se alterar os valores, clique em “Gerar análise” para recalcular o texto automático; isso substitui o resumo e a recomendação atuais.",
      "Registre em “Observações e aprovação” o que precisa constar no documento final.",
    ],
    tip: "O botão “Gerar análise” recalcula um texto a partir dos preços informados; ele não relê os PDFs.",
    keywords: "parecer tecnico gerar analise recomendacao aprovar conselho observacoes resumo recalcular",
  },
  {
    id: "salvar", category: "salvar", label: "Salvar e consultar", title: "Salvar o mapa e acompanhar o status",
    description: "Guarde o trabalho e volte a editá-lo pelo painel quando precisar.",
    steps: [
      "Selecione o status “Rascunho”, “Em análise” ou “Concluído” no alto do editor.",
      "Clique em “Salvar” e aguarde a confirmação. O mapa não é salvo automaticamente a cada alteração.",
      "Para abrir novamente, volte ao painel e encontre o mapa pela busca, pelo condomínio, objeto ou protocolo.",
      "Abra o mapa, altere o que precisar e clique novamente em “Salvar”.",
    ],
    tip: "O condomínio informado é adicionado às sugestões do aplicativo quando o mapa é salvo.",
    keywords: "salvar rascunho concluido em analise status historico buscar editar alterar protocolo",
  },
  {
    id: "indicadores", category: "salvar", label: "Assembleia", title: "Registrar economia e apresentar indicadores",
    description: "Mostre ao condomínio a diferença entre a estimativa e a economia confirmada.",
    steps: [
      "No editor do mapa, em “Resultado da contratação”, selecione o fornecedor contratado e informe o valor de referência e o valor contratado.",
      "Marque a confirmação, altere o status do mapa para “Concluído” e clique em “Salvar”. A economia confirmada é a referência menos o valor contratado.",
      "No menu, clique em “Indicadores” e filtre por condomínio e período para preparar a apresentação.",
      "Clique em “Baixar PDF” para gerar o dashboard em arquivo, pronto para projetar ou imprimir. “Baixar CSV” abre os dados em planilha.",
      "O histórico de downloads no rodapé da página mostra cada arquivo gerado, com nome, data e tamanho.",
    ],
    tip: "A economia potencial compara propostas completas e não é lucro realizado. O indicador confirmado depende dos valores informados e aprovados pela equipe.",
    keywords: "kpi indicadores dashboard assembleia economia lucro contratacao referencia csv relatorio",
  },
  {
    id: "imprimir", category: "salvar", label: "Documento final", title: "Visualizar, imprimir ou salvar em PDF",
    description: "Confira o documento antes de apresentá-lo ao condomínio.",
    steps: [
      "No editor, clique em “Ver documento” ou “Pré-visualizar documento” para conferir o cabeçalho, a tabela e o parecer.",
      "Clique em “Imprimir / PDF”. Se houver alterações, o aplicativo pedirá o salvamento antes de abrir o documento de impressão.",
      "Para um arquivo pronto para envio, clique em “Baixar PDF” no editor ou na pré-visualização. O arquivo é gerado pelo aplicativo e salvo na sua pasta de downloads.",
      "O nome do arquivo gerado (protocolo, condomínio e data) fica registrado no histórico de downloads.",
      "Se preferir o layout do navegador, use “Imprimir” e escolha a impressora ou “Salvar como PDF”.",
    ],
    tip: "Cada download é registrado no histórico da página Indicadores, com nome, data e tamanho do arquivo.",
    keywords: "imprimir exportar baixar salvar pdf documento visualizar pre visualizar assinatura",
  },
];

const QUESTIONS: Question[] = [
  {
    category: "inicio", question: "Posso editar o condomínio, a data e os demais campos depois?",
    answer: "Sim. Abra o mapa no painel e altere os campos em “Identificação do mapa”. Clique em “Salvar” para guardar as alterações.",
    keywords: "cabecalho mudar data ac objeto descricao editar condominio",
  },
  {
    category: "ia", question: "O que fazer se a IA mostrar erro 503 ou demorar?",
    answer: "O Google pode recusar uma solicitação por disponibilidade do modelo, mesmo quando o painel geral está ativo. O aplicativo tenta novamente e pode usar outro modelo Gemini compatível. Se persistir, seus arquivos continuam selecionados: confira o status e a cota no Google AI Studio e tente novamente. A porcentagem mostrada é estimada.",
    keywords: "503 erro google demorar tempo limite instavel status retry",
  },
  {
    category: "ia", question: "Posso comparar três propostas no mesmo mapa?",
    answer: "Sim. Selecione os três arquivos juntos e execute uma única análise. Ao aplicar uma nova análise em um mapa existente, os fornecedores e itens atuais são substituídos; ela não une resultados de envios separados.",
    keywords: "3 tres pdf varios fornecedores juntos anexos substituir",
  },
  {
    category: "ia", question: "A IA não identificou um preço ou fornecedor. Como corrigir?",
    answer: "Depois de aplicar a análise, edite diretamente os campos de fornecedores, itens, quantidades e valores no mapa. Confira sempre as informações extraídas nos documentos originais.",
    keywords: "corrigir leitura editar faltou fornecedores valor",
  },
  {
    category: "comparar", question: "Um fornecedor não cotou todos os itens. O que faço?",
    answer: "Deixe os preços não cotados em branco e confira o escopo. O total será parcial e não será usado como melhor proposta completa nem no cálculo de economia global. Solicite os valores restantes ou registre a ressalva na análise.",
    keywords: "parcial vazio completo nao cotado menor fornecedor economia cobertura",
  },
  {
    category: "salvar", question: "Os PDFs e imagens originais ficam guardados no site?",
    answer: "Nesta versão, o mapa salva os dados extraídos e informações como o nome dos anexos, mas não arquiva os arquivos originais para download. Guarde as propostas em um local seguro da empresa.",
    keywords: "arquivo original anexo guardar download armazenar pdf imagem",
  },
  {
    category: "salvar", question: "Como faço para salvar o documento em PDF?",
    answer: "Salve o mapa, clique em “Imprimir / PDF” e, na janela do navegador, escolha “Salvar como PDF”. Se a janela não abrir, permita pop-ups para o aplicativo.",
    keywords: "baixar exportar pdf imprimir pop up janela",
  },
  {
    category: "ia", question: "Como proteger a chave de API e os documentos?",
    answer: "Trate a chave como senha: não a envie em mensagens nem a publique no GitHub. Se uma chave foi compartilhada, revogue-a e gere outra no Google AI Studio. Proteja o acesso ao aplicativo antes de inserir dados reais e consulte os termos do provedor de IA e as regras de privacidade da empresa.",
    keywords: "seguranca privacidade chave api gemini dados confidenciais",
  },
];

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function HelpCenter() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("todos");
  const term = normalize(query);
  const filteredTopics = useMemo(() => TOPICS.filter((topic) => {
    const matchesCategory = category === "todos" || topic.category === category;
    const text = normalize([topic.title, topic.description, topic.label, topic.steps.join(" "), topic.tip ?? "", topic.keywords].join(" "));
    return matchesCategory && (!term || text.includes(term));
  }), [category, term]);
  const filteredQuestions = useMemo(() => QUESTIONS.filter((item) => {
    const matchesCategory = category === "todos" || item.category === category;
    const text = normalize(`${item.question} ${item.answer} ${item.keywords}`);
    return matchesCategory && (!term || text.includes(term));
  }), [category, term]);
  const matches = filteredTopics.length + filteredQuestions.length;

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <nav aria-label="Localização" className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
        <Link href="/" className="transition hover:text-ink">Painel</Link>
        <span className="text-slate-300">/</span>
        <span className="text-ink">Central de ajuda</span>
      </nav>

      <section className="relative mt-4 overflow-hidden rounded-2xl bg-ink px-6 py-8 text-white sm:px-9 sm:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border-[44px] border-brand/[0.07]" />
        <div aria-hidden="true" className="pointer-events-none absolute right-28 top-0 hidden h-full w-px bg-white/[0.06] lg:block" />
        <div className="relative max-w-[720px]">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-white/5 px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Central de ajuda · Gerencial
          </p>
          <h1 className="font-display mt-4 text-[30px] leading-tight sm:text-[40px]">Como podemos ajudar?</h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/70 sm:text-[14px]">
            Aprenda a criar, comparar e apresentar seus mapas de cotação. Encontre orientações para cada etapa, sem complicação.
          </p>
          <label htmlFor="help-search" className="sr-only">Buscar na central de ajuda</label>
          <div className="relative mt-5 max-w-[560px]">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              id="help-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busque por IA, fornecedores, PDF..."
              className="h-12 w-full rounded-xl border border-white/15 bg-white pl-11 pr-4 text-[13px] text-ink shadow-lg outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-brand/40"
            />
          </div>
          <p className="mt-3 text-[10.5px] text-white/50">Sugestões: editar cabeçalho · analisar propostas · salvar PDF</p>
        </div>
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          { icon: <PlusIcon className="h-4.5 w-4.5" />, title: "Começar uma cotação", text: "Crie um novo mapa para seu condomínio.", href: "/mapas/novo" },
          { icon: <SparklesIcon className="h-4.5 w-4.5" />, title: "Configurar a IA", text: "Conecte ou teste a chave do Gemini.", href: "/configuracoes" },
          { icon: <FileIcon className="h-4.5 w-4.5" />, title: "Ver mapas salvos", text: "Consulte e edite suas cotações.", href: "/#mapas" },
        ].map((item) => (
          <Link key={item.title} href={item.href} className="card group flex items-start gap-3 px-4 py-4 transition hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-md">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-dark">{item.icon}</span>
            <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-bold text-ink">{item.title}</span><span className="mt-1 block text-[11px] leading-snug text-slate-500">{item.text}</span></span>
            <ArrowRightIcon className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-ink" />
          </Link>
        ))}
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-dark">Encontre sua resposta</p>
              <h2 className="font-display mt-1 text-[23px] text-ink">Usando o mapa de cotação</h2>
              <p className="mt-1 text-[12px] text-slate-500">Escolha um assunto e abra o passo a passo.</p>
            </div>
            {(query || category !== "todos") && <span role="status" className="text-[11px] font-semibold text-slate-500">{matches} resultado(s)</span>}
          </div>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtrar assuntos da ajuda">
            {FILTERS.map((filter) => (
              <button key={filter.id} type="button" aria-pressed={category === filter.id} onClick={() => setCategory(filter.id)}
                className={`rounded-full px-3.5 py-2 text-[11px] font-bold transition ${category === filter.id ? "bg-ink text-white" : "border border-line bg-white text-slate-600 hover:border-brand hover:text-ink"}`}>
                {filter.label}
              </button>
            ))}
          </div>

          {matches === 0 ? (
            <div className="card mt-4 px-5 py-10 text-center">
              <SearchIcon className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-3 text-[13px] font-bold text-ink">Nenhum assunto encontrado</p>
              <p className="mt-1 text-[12px] text-slate-500">Tente outra palavra, como “PDF”, “preço” ou “fornecedor”.</p>
              <button type="button" onClick={() => { setQuery(""); setCategory("todos"); }} className="btn btn-ghost mt-4">Limpar busca</button>
            </div>
          ) : (
            <>
              {filteredTopics.length > 0 && (
                <section className="mt-4 space-y-2.5" aria-label="Guias de uso">
                  {filteredTopics.map((topic, index) => (
                    <details key={topic.id} id={topic.id} className="card group scroll-mt-24 overflow-hidden" open={term ? true : undefined}>
                      <summary className="flex cursor-pointer list-none items-start gap-3.5 px-4 py-4 [&::-webkit-details-marker]:hidden sm:px-5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-paper text-[11px] font-extrabold text-ink">{String(index + 1).padStart(2, "0")}</span>
                        <span className="min-w-0 flex-1">
                          <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-brand-dark">{topic.label}</span>
                          <span className="mt-0.5 block text-[13.5px] font-extrabold text-ink">{topic.title}</span>
                          <span className="mt-1 block text-[11.5px] leading-snug text-slate-500">{topic.description}</span>
                        </span>
                        <span aria-hidden="true" className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper text-[18px] font-normal leading-none text-ink transition group-open:rotate-45">+</span>
                      </summary>
                      <div className="border-t border-line px-4 pb-5 pt-4 sm:px-5 sm:pl-[70px]">
                        <ol className="space-y-3">
                          {topic.steps.map((step, stepIndex) => (
                            <li key={step} className="flex gap-2.5 text-[12px] leading-relaxed text-slate-600">
                              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">{stepIndex + 1}</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                        {topic.tip && <p className="mt-4 rounded-lg border border-brand/20 bg-brand-soft/70 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-900"><strong>Dica: </strong>{topic.tip}</p>}
                      </div>
                    </details>
                  ))}
                </section>
              )}

              {filteredQuestions.length > 0 && (
                <section id="duvidas" className="mt-9 scroll-mt-24">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-dark">Respostas rápidas</p><h2 className="font-display mt-1 text-[21px] text-ink">Dúvidas frequentes</h2></div>
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-ink ring-1 ring-line"><span className="text-[17px] font-bold">?</span></span>
                  </div>
                  <div className="space-y-2">
                    {filteredQuestions.map((item) => (
                      <details key={item.question} className="card group px-4 py-3.5" open={term ? true : undefined}>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[12.5px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                          {item.question}<span aria-hidden="true" className="text-[17px] text-brand-dark transition group-open:rotate-45">+</span>
                        </summary>
                        <p className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-slate-600">{item.answer}</p>
                      </details>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-dark">Atalhos úteis</p>
              <h2 className="mt-1 text-[14px] font-extrabold text-ink">Precisa de um caminho rápido?</h2>
            </div>
            <div className="space-y-1 p-2">
              {[
                { icon: <BuildingIcon className="h-4 w-4" />, label: "Criar minha primeira cotação", href: "/mapas/novo" },
                { icon: <SparklesIcon className="h-4 w-4" />, label: "Conectar ou testar a IA", href: "/configuracoes" },
                { icon: <TrendIcon className="h-4 w-4" />, label: "Consultar mapas e resultados", href: "/#mapas" },
                { icon: <PrinterIcon className="h-4 w-4" />, label: "Como imprimir ou gerar PDF", href: "#imprimir" },
              ].map((item) => item.href.startsWith("#") ? (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCategory("todos");
                    window.setTimeout(() => {
                      const target = document.getElementById(item.href.slice(1));
                      if (target instanceof HTMLDetailsElement) target.open = true;
                      target?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 50);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[11.5px] font-semibold text-slate-600 transition hover:bg-paper hover:text-ink"
                >
                  <span className="text-brand-dark">{item.icon}</span><span className="flex-1">{item.label}</span><ArrowRightIcon className="h-3.5 w-3.5 text-slate-400" />
                </button>
              ) : (
                <Link key={item.label} href={item.href} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[11.5px] font-semibold text-slate-600 transition hover:bg-paper hover:text-ink">
                  <span className="text-brand-dark">{item.icon}</span><span className="flex-1">{item.label}</span><ArrowRightIcon className="h-3.5 w-3.5 text-slate-400" />
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-ink p-5 text-white">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-ink"><SparklesIcon className="h-4.5 w-4.5" /></span>
            <h2 className="mt-3 text-[14px] font-bold">Sua IA precisa de atenção?</h2>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/70">Aprenda a configurar a chave, testar a conexão e lidar com mensagens do Google.</p>
            <Link href="/ajuda/ia" className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-bold text-brand hover:underline">Abrir guia de IA <ArrowRightIcon className="h-3.5 w-3.5" /></Link>
          </section>

          <section className="rounded-xl border border-brand/30 bg-brand-soft/60 p-4">
            <p className="flex items-center gap-2 text-[11px] font-extrabold text-ink"><CheckIcon className="h-4 w-4 text-brand-dark" /> Antes de encaminhar</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">Revise preços, escopo, condições e parecer. A IA ajuda na leitura, mas a conferência final é da equipe.</p>
          </section>

          <Link href="/ajuda/publicar" className="block px-1 text-[11px] font-bold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-ink">Guia técnico de publicação na Vercel ↗</Link>
        </aside>
      </div>
      <p className="mt-10 border-t border-line pt-5 text-center text-[10.5px] text-slate-400">Gerencial · Governança Condominial — apoio para decisões mais claras.</p>
    </main>
  );
}
