"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, FileCheck2, LoaderCircle, Plus, Printer, Save, Sparkles, Trash2 } from "lucide-react";
import { fmtDate } from "@/lib/brand";
import type { DeliveryTermDraft } from "@/lib/delivery-terms";
import type { ProposalItem } from "@/lib/proposal/types";
import { DeliveryTermDocument } from "@/components/delivery-term/DeliveryTermDocument";
import { fetchJson } from "@/lib/api-client";

type ProposalInfo = {
  id: string;
  number: string;
  revision: number;
  status: string;
  clientName: string;
  contact: string | null;
  clientEmail: string | null;
  site: string | null;
  warranty: string | null;
  deliveryTime: string | null;
  items: ProposalItem[];
};

type TermForm = Omit<DeliveryTermDraft, "status"> & { id?: string; number?: string; status: "rascunho" | "entregue" | "aceito" };

function freshDraft(proposal: ProposalInfo): TermForm {
  const lines = proposal.items
    .filter((item) => !/monitoramento|\bNOC\b|ronda virtual/i.test(`${item.desc} ${item.spec}`))
    .map((item) => ({ ...item }));
  const itemsText = lines.length
    ? lines.map((item) => `• ${item.qty} ${item.unit} — ${item.desc}${item.spec ? ` (${item.spec})` : ""}`).join("\n")
    : "Nenhum item foi registrado na proposta vinculada.";
  return {
    proposalId: proposal.id,
    proposalNumber: proposal.number,
    proposalRevision: proposal.revision,
    clientId: null,
    clientName: proposal.clientName,
    contact: proposal.contact ?? "",
    clientEmail: proposal.clientEmail ?? "",
    site: proposal.site ?? "",
    title: "Termo de entrega e aceite técnico",
    deliveryDate: new Date().toISOString().slice(0, 10),
    status: "rascunho",
    items: lines,
    sections: [
      { id: "objeto", title: "1. Objeto e referência", body: `Registro de entrega técnica referente à proposta ${proposal.number}, revisão ${proposal.revision}.\n\nObjeto: preencher a data, os itens efetivamente entregues e as ressalvas verificadas no local. A proposta vinculada integra este termo como referência do escopo aprovado.` },
      { id: "itens", title: "2. Itens e serviços previstos", body: itemsText },
      { id: "conferencia", title: "3. Conferência e funcionamento", body: "No ato, as partes devem conferir descrição, quantidades, estado aparente e funcionamento dos itens listados. Registre abaixo apenas os testes realmente executados e os resultados observados.\n\nTestes e orientações realizados: preencher no ato." },
      { id: "documentacao", title: "4. Documentação, garantia e suporte", body: `Documentos entregues (manuais, projeto, ART, as-built e registros de teste): preencher no ato.\n\nGarantia e condições de suporte: ${proposal.warranty || "conforme a proposta e os documentos firmados entre as partes"}.\n\nEste termo registra a entrega e não altera preço, escopo, prazo ou cobertura estabelecidos na proposta e no contrato eventualmente firmado.` },
      { id: "pendencias", title: "5. Pendências e ressalvas", body: "Nenhuma pendência informada. Altere este campo para indicar item pendente, responsável e prazo combinado, ou confirme “Nenhuma” após a conferência." },
      { id: "aceite", title: "6. Declaração e aceite", body: "As partes declaram que conferiram os itens efetivamente entregues e os resultados descritos neste termo. O aceite fica limitado ao conteúdo e às ressalvas expressamente registradas, sem modificar as condições comerciais contratadas.\n\nAssinado no local e na data informados neste documento." },
    ],
    generatedByAi: false,
  };
}

export function DeliveryTermWorkspace({
  proposal,
  initialTerm,
  settings,
}: {
  proposal: ProposalInfo;
  initialTerm?: (TermForm & { number: string }) | null;
  settings: { companyName: string; legalName: string; cnpj: string; crea: string; address: string; phone: string; email: string };
}) {
  const router = useRouter();
  const [term, setTerm] = useState<TermForm>(initialTerm ?? freshDraft(proposal));
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const update = (patch: Partial<TermForm>) => setTerm((prev) => ({ ...prev, ...patch }));
  const updateSection = (id: string, patch: { title?: string; body?: string }) =>
    setTerm((prev) => ({ ...prev, sections: prev.sections.map((section) => section.id === id ? { ...section, ...patch } : section) }));
  const updateItem = (id: string, patch: Partial<ProposalItem>) =>
    setTerm((prev) => ({ ...prev, items: prev.items.map((item) => item.id === id ? { ...item, ...patch } : item) }));

  async function generate() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await fetchJson<{ draft: DeliveryTermDraft; source: "ia" | "modelo" }>("/api/delivery-terms/generate", {
        method: "POST",
        body: JSON.stringify({ proposalId: proposal.id }),
      });
      setTerm((prev) => ({ ...prev, ...result.draft, id: prev.id, number: prev.number, status: prev.status }));
      setNotice(result.source === "ia"
        ? "Minuta elaborada com IA a partir da proposta. Confira e edite todos os blocos antes de imprimir ou assinar."
        : "Modelo profissional preenchido com a proposta. Para gerar com IA, configure OPENAI_API_KEY na Vercel; todos os blocos seguem editáveis.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o termo.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        proposalId: term.proposalId,
        clientName: term.clientName,
        contact: term.contact,
        clientEmail: term.clientEmail,
        site: term.site,
        title: term.title,
        deliveryDate: term.deliveryDate,
        status: term.status,
        items: term.items,
        sections: term.sections,
        generatedByAi: term.generatedByAi,
      };
      if (term.id) {
        const result = await fetchJson<{ term: { id: string; number: string } }>(`/api/delivery-terms/${term.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        setTerm((prev) => ({ ...prev, ...result.term }));
        setNotice("Termo salvo.");
        router.refresh();
      } else {
        const result = await fetchJson<{ term: { id: string; number: string } }>("/api/delivery-terms", { method: "POST", body: JSON.stringify(payload) });
        setTerm((prev) => ({ ...prev, id: result.term.id, number: result.term.number }));
        setNotice("Termo salvo. Você já pode imprimir ou continuar editando.");
        router.replace(`/termos-entrega/${result.term.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o termo.");
    } finally {
      setSaving(false);
    }
  }

  function addSection() {
    const id = `custom-${Date.now().toString(36)}`;
    setTerm((prev) => ({ ...prev, sections: [...prev.sections, { id, title: "Novo bloco", body: "" }] }));
  }

  function moveSection(index: number, direction: -1 | 1) {
    setTerm((prev) => {
      const next = [...prev.sections];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, sections: next };
    });
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5 lg:px-7">
      <div className="no-print mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-line/50 pb-4">
        <div>
          <div className="label-mono text-signal">Documento vinculado à proposta {term.proposalNumber}</div>
          <h1 className="mt-1 font-display text-2xl font-semibold text-white">{term.number ?? "Novo termo de entrega"}</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-steel">
            Elabore, revise e imprima o termo profissional. Todos os campos e blocos são editáveis; o termo não altera a proposta nem confirma tarefas que não foram realizadas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={term.id ? "/termos-entrega" : `/propostas/${proposal.id}`} className="btn">Voltar</Link>
          <button type="button" onClick={() => window.print()} className="btn" disabled={!term.id}>
            <Printer size={14}/> Imprimir / salvar PDF
          </button>
          <button type="button" onClick={generate} disabled={busy || saving} className="btn btn-primary">
            {busy ? <LoaderCircle size={14} className="animate-spin"/> : <Sparkles size={14}/>}
            {busy ? "Elaborando…" : "Gerar / revisar com IA"}
          </button>
          <button type="button" onClick={save} disabled={saving || busy} className="btn btn-primary">
            {saving ? <LoaderCircle size={14} className="animate-spin"/> : <Save size={14}/>}
            {saving ? "Salvando…" : term.id ? "Salvar alterações" : "Salvar termo"}
          </button>
        </div>
      </div>

      <div className="no-print mb-4 grid gap-3 sm:grid-cols-3">
        <label className="block"><span className="label-mono mb-1 block">Situação do termo</span><select className="field" value={term.status} onChange={(e) => update({ status: e.target.value as TermForm["status"] })}><option value="rascunho">Rascunho</option><option value="entregue">Entregue</option><option value="aceito">Aceito pelo cliente</option></select></label>
        <Field label="Data da entrega"><input className="field" type="date" value={term.deliveryDate} onChange={(e) => update({ deliveryDate: e.target.value })}/></Field>
        <Field label="Número da proposta"><input className="field" value={`${term.proposalNumber} · R${term.proposalRevision}`} readOnly/></Field>
      </div>

      {notice ? <div className="no-print mb-3 rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-3 text-[11px] text-emerald-200">{notice}</div> : null}
      {error ? <div role="alert" className="no-print mb-3 rounded-lg border border-alarm/35 bg-alarm/5 p-3 text-[11px] text-alarm">{error}</div> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="print-area overflow-x-auto rounded-xl border border-line/50 bg-[#0b1728] p-4">
          <DeliveryTermDocument term={term} settings={settings} edit={{ update, updateSection, updateItem }}/>
        </div>
        <aside className="no-print space-y-4">
          <section className="card p-4">
            <div className="label-mono text-signal">Identificação e local</div>
            <div className="mt-3 space-y-3">
              <Field label="Título do termo"><input className="field" value={term.title} onChange={(e) => update({ title: e.target.value })}/></Field>
              <Field label="Cliente"><input className="field" value={term.clientName} onChange={(e) => update({ clientName: e.target.value })}/></Field>
              <div className="grid grid-cols-2 gap-2"><Field label="Representante"><input className="field" value={term.contact} onChange={(e) => update({ contact: e.target.value })}/></Field><Field label="E-mail"><input className="field" value={term.clientEmail} onChange={(e) => update({ clientEmail: e.target.value })}/></Field></div>
              <Field label="Endereço/local"><textarea className="field min-h-[62px]" value={term.site} onChange={(e) => update({ site: e.target.value })}/></Field>
            </div>
          </section>

          <section className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div><div className="label-mono text-signal">Itens da proposta</div><p className="mt-1 text-[10.5px] text-steel">Ajuste a lista para refletir o que será conferido no local.</p></div>
              <span className="chip">{term.items.length} itens</span>
            </div>
            <div className="mt-3 space-y-2">
              {term.items.map((item) => (
                <div key={item.id} className="rounded-lg border border-line/50 bg-abyss2/40 p-2">
                  <div className="flex items-center gap-2"><input className="field text-[11px]" value={item.desc} onChange={(e) => updateItem(item.id, { desc: e.target.value })}/><button type="button" aria-label="Remover item" className="text-alarm" onClick={() => update({ items: term.items.filter((row) => row.id !== item.id) })}><Trash2 size={13}/></button></div>
                  <div className="mt-1.5 grid grid-cols-[1fr_65px_60px] gap-1.5"><input className="field text-[10px]" placeholder="Especificação" value={item.spec} onChange={(e) => updateItem(item.id, { spec: e.target.value })}/><input className="field text-[10px]" type="number" min={0} step="0.01" value={item.qty} onChange={(e) => updateItem(item.id, { qty: Number(e.target.value) || 0 })}/><input className="field text-[10px]" value={item.unit} onChange={(e) => updateItem(item.id, { unit: e.target.value })}/></div>
                </div>
              ))}
              <button type="button" className="btn w-full" onClick={() => update({ items: [...term.items, { id: `term-item-${Date.now()}`, kind: "equipamento", desc: "Novo item", spec: "", unit: "un", qty: 1, price: 0 }] })}><Plus size={13}/> Adicionar item entregue</button>
            </div>
          </section>

          <section className="card p-4">
            <div className="flex items-center justify-between gap-2"><div><div className="label-mono text-signal">Blocos editáveis</div><p className="mt-1 text-[10px] text-steel">Edite título e texto, reordene ou remova.</p></div><button type="button" className="btn py-1" onClick={addSection}><Plus size={13}/> Bloco</button></div>
            <div className="mt-3 space-y-2">
              {term.sections.map((section, index) => (
                <details key={section.id} className="rounded-lg border border-line/50 bg-abyss2/40" open={index === 0}>
                  <summary className="flex cursor-pointer items-center gap-2 px-2.5 py-2"><span className="flex-1 truncate text-[11px] text-silver">{section.title}</span><button type="button" className="text-steel" aria-label="Subir" onClick={(e) => { e.preventDefault(); moveSection(index, -1); }}><ArrowUp size={12}/></button><button type="button" className="text-steel" aria-label="Descer" onClick={(e) => { e.preventDefault(); moveSection(index, 1); }}><ArrowDown size={12}/></button><button type="button" className="text-alarm" aria-label="Excluir" onClick={(e) => { e.preventDefault(); update({ sections: term.sections.filter((s) => s.id !== section.id) }); }}><Trash2 size={12}/></button></summary>
                  <div className="space-y-2 border-t border-line/40 p-2"><input className="field text-[11px]" value={section.title} onChange={(e) => updateSection(section.id, { title: e.target.value })}/><textarea className="field min-h-[130px] text-[11px] leading-relaxed" value={section.body} onChange={(e) => updateSection(section.id, { body: e.target.value })}/></div>
                </details>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-line/50 bg-navy/30 p-4"><div className="flex items-center gap-2 text-signal"><FileCheck2 size={15}/><span className="label-mono">Revisão antes da assinatura</span></div><p className="mt-2 text-[10.5px] leading-relaxed text-steel">Confira data, quantidades, testes realmente executados e pendências. O termo é um registro de entrega; não substitui contrato, nota fiscal ou orientação jurídica.</p></section>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label-mono mb-1 block">{label}</span>{children}</label>;
}
