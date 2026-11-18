"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, FileDown, LoaderCircle, Plus, Printer, Sparkles, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import {
  DeliveryTermDocument,
  type DeliveryTermDocData,
  type DeliveryTermDocSettings,
} from "@/components/delivery/DeliveryTermDocument";

export type EditableTerm = DeliveryTermDocData & {
  id: string;
  proposalId: string | null;
  createdAt: string;
  updatedAt: string;
};

const uid = () => `dt-${Math.random().toString(36).slice(2, 9)}`;
const toDateInput = (value: string | Date | null) => {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const TEXT_FIELDS: { key: "intro" | "scopeSummary" | "tests" | "pendencies" | "warranty" | "observations"; label: string; hint: string; rows: number }[] = [
  { key: "intro", label: "01 · Identificação da entrega", hint: "Quem entrega, para quem, de qual proposta e onde.", rows: 5 },
  { key: "scopeSummary", label: "02 · Escopo entregue", hint: "Resumo por disciplina. Use • para bullets.", rows: 6 },
  { key: "tests", label: "03 · Testes executados", hint: "Testes de campo aprovados, um por linha com •.", rows: 5 },
  { key: "pendencies", label: "04 · Pendências", hint: "O que ficou pendente e o prazo combinado.", rows: 3 },
  { key: "warranty", label: "05 · Garantia", hint: "Cobertura e exclusões.", rows: 3 },
  { key: "observations", label: "06 · Observações e aceite", hint: "Responsável técnico, canais de garantia e instruções.", rows: 4 },
];

export function DeliveryTermEditor({
  initial,
  settings,
  aiEnabled,
}: {
  initial: EditableTerm;
  settings: DeliveryTermDocSettings;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [term, setTerm] = useState<EditableTerm>(initial);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState("");

  function update(patch: Partial<EditableTerm>) {
    setTerm((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const data = await fetchJson<{ term: EditableTerm }>(`/api/delivery-terms/${term.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          clientName: term.clientName,
          site: term.site,
          deliveryDate: term.deliveryDate,
          technician: term.technician,
          receiverName: term.receiverName,
          receiverDoc: term.receiverDoc,
          items: term.items,
          intro: term.intro,
          scopeSummary: term.scopeSummary,
          tests: term.tests,
          pendencies: term.pendencies,
          warranty: term.warranty,
          observations: term.observations,
          status: term.status,
        }),
      });
      setTerm(data.term);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString("pt-BR"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function newRevision() {
    if (!term.proposalId) return;
    if (!window.confirm("Criar um novo termo a partir da mesma proposta? O atual será preservado.")) return;
    setSaving(true);
    setError("");
    try {
      const data = await fetchJson<{ term: { id: string } }>("/api/delivery-terms", {
        method: "POST",
        body: JSON.stringify({ proposalId: term.proposalId }),
      });
      router.push(`/termos/${data.term.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar novo termo.");
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Excluir o termo ${term.termNumber}? A proposta de origem será preservada.`)) return;
    try {
      await fetchJson(`/api/delivery-terms/${term.id}`, { method: "DELETE" });
      router.push(term.proposalId ? `/propostas/${term.proposalId}` : "/termos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir.");
    }
  }

  async function polishAll() {
    setAiBusy(true);
    setAiNote("");
    setError("");
    try {
      const data = await fetchJson<{ blocks: Partial<EditableTerm> }>("/api/delivery-terms/" + term.id + "/polish", {
        method: "POST",
        body: JSON.stringify({ fields: ["intro", "scopeSummary", "tests", "pendencies", "warranty", "observations"] }),
      });
      update(data.blocks);
      setAiNote("Redação refinada por IA. Confira os textos e salve para confirmar.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "IA indisponível.");
    } finally {
      setAiBusy(false);
    }
  }

  async function downloadPdf() {
    setPdfBusy(true);
    setError("");
    try {
      const [{ jsPDF }, pdfKit] = await Promise.all([import("jspdf"), import("@/lib/pdf-documents")]);
      const logo = await pdfKit.loadBrandLogo();
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      pdfKit.renderDeliveryTermPdf(pdf, term, settings, logo);
      pdf.save(`${term.termNumber}-${term.clientName.replace(/\s+/g, "-")}.pdf`);
    } catch (err) {
      console.error(err);
      setError("Não foi possível gerar o PDF. Tente novamente ou use a impressão do navegador.");
    } finally {
      setPdfBusy(false);
    }
  }

  const checked = term.items.filter((i) => i.checked).length;

  return (
    <div className="min-h-screen bg-abyss">
      <header className="no-print sticky top-0 z-30 border-b border-line/60 bg-abyss/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={term.proposalId ? `/propostas/${term.proposalId}` : "/termos"}
              className="btn px-2.5 py-1.5 text-[11px]"
            >
              ←
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-[0.18em] text-signal">{term.termNumber}</span>
                {term.proposalNumber ? <span className="chip">Ref. {term.proposalNumber}</span> : null}
              </div>
              <h1 className="truncate font-display text-[17px] font-semibold text-white">
                Termo de entrega · {term.clientName}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`hidden text-[11px] sm:block ${dirty ? "text-amber" : "text-steel"}`}>
              {dirty ? "Alterações não salvas" : savedAt ? `Salvo ${savedAt}` : "Tudo salvo"}
            </span>
            <select
              className="field w-auto py-1.5 text-[12px]"
              value={term.status}
              onChange={(e) => update({ status: e.target.value })}
            >
              <option value="rascunho">Rascunho</option>
              <option value="pronto">Pronto p/ assinatura</option>
              <option value="assinado">Assinado</option>
            </select>
            {term.proposalId ? (
              <button className="btn" onClick={newRevision} disabled={saving}>
                Nova revisão
              </button>
            ) : null}
            <button className="btn" onClick={remove}>
              <Trash2 size={14} /> Excluir
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button className="btn btn-primary" onClick={downloadPdf} disabled={pdfBusy}>
              {pdfBusy ? <LoaderCircle size={14} className="animate-spin" /> : <FileDown size={14} />}
              {pdfBusy ? "Gerando PDF A4…" : "Baixar PDF"}
            </button>
            <button className="btn" onClick={() => window.print()}>
              <Printer size={14} /> Imprimir
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div role="alert" className="mx-4 mt-3 rounded-lg border border-alarm/35 bg-alarm/5 p-3 text-[12px] text-alarm lg:mx-6">
          {error}
        </div>
      ) : null}
      {aiNote ? (
        <div role="status" className="mx-4 mt-3 rounded-lg border border-signal/30 bg-signal/5 p-3 text-[12px] text-silver lg:mx-6">
          {aiNote}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-6">
        <div className="print-area scroll-thin overflow-x-auto rounded-xl border border-line/50 bg-[#0b1728] p-4">
          <div className="mx-auto w-[794px]">
            <DeliveryTermDocument term={term} settings={settings} onChange={update} />
          </div>
        </div>

        <aside className="no-print space-y-3">
          <section className="card p-4">
            <div className="label-mono text-signal">Dados da entrega</div>
            <div className="mt-3 space-y-2.5">
              <Field label="Cliente">
                <input className="field" value={term.clientName} onChange={(e) => update({ clientName: e.target.value })} />
              </Field>
              <Field label="Local da entrega">
                <input className="field" value={term.site ?? ""} onChange={(e) => update({ site: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Data da entrega">
                  <input
                    type="date"
                    className="field"
                    value={toDateInput(term.deliveryDate)}
                    onChange={(e) => update({ deliveryDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })}
                  />
                </Field>
                <Field label="Técnico responsável">
                  <input className="field" value={term.technician} onChange={(e) => update({ technician: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Recebedor (cliente)">
                  <input className="field" value={term.receiverName} onChange={(e) => update({ receiverName: e.target.value })} placeholder="Nome de quem assina" />
                </Field>
                <Field label="Doc. do recebedor">
                  <input className="field" value={term.receiverDoc} onChange={(e) => update({ receiverDoc: e.target.value })} placeholder="CPF / RG" />
                </Field>
              </div>
            </div>
          </section>

          <section className="card p-4">
            <div className="flex items-center justify-between">
              <div className="label-mono text-signal">Checklist · {checked}/{term.items.length} conferidos</div>
              <button
                className="btn px-2 py-1 text-[11px]"
                onClick={() =>
                  update({
                    items: [
                      ...term.items,
                      { id: uid(), desc: "Novo item entregue", spec: "", unit: "un", qty: 1, checked: false, serial: "", obs: "" },
                    ],
                  })
                }
              >
                <Plus size={12} /> Item
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {term.items.map((item) => (
                <div key={item.id} className="rounded-lg border border-line/60 bg-abyss2/50 p-2">
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() =>
                        update({ items: term.items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)) })
                      }
                      className={`mt-0.5 shrink-0 ${item.checked ? "text-armed" : "text-steel"}`}
                      title={item.checked ? "Marcar como não conferido" : "Marcar como conferido"}
                    >
                      <CheckCircle2 size={17} />
                    </button>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <input
                        className="field text-[12px]"
                        value={item.desc}
                        onChange={(e) => update({ items: term.items.map((i) => (i.id === item.id ? { ...i, desc: e.target.value } : i)) })}
                      />
                      <div className="grid grid-cols-3 gap-1.5">
                        <input
                          className="field text-[11px]"
                          value={item.unit}
                          onChange={(e) => update({ items: term.items.map((i) => (i.id === item.id ? { ...i, unit: e.target.value } : i)) })}
                          placeholder="un"
                        />
                        <input
                          type="number"
                          className="field text-[11px]"
                          value={item.qty}
                          onChange={(e) => update({ items: term.items.map((i) => (i.id === item.id ? { ...i, qty: Number(e.target.value) } : i)) })}
                        />
                        <input
                          className="field text-[11px]"
                          value={item.serial}
                          onChange={(e) => update({ items: term.items.map((i) => (i.id === item.id ? { ...i, serial: e.target.value } : i)) })}
                          placeholder="Nº série"
                        />
                      </div>
                      <input
                        className="field text-[11px]"
                        value={item.obs}
                        onChange={(e) => update({ items: term.items.map((i) => (i.id === item.id ? { ...i, obs: e.target.value } : i)) })}
                        placeholder="Observação do item"
                      />
                    </div>
                    <button
                      className="shrink-0 text-[11px] text-alarm"
                      onClick={() => update({ items: term.items.filter((i) => i.id !== item.id) })}
                    >
                      remover
                    </button>
                  </div>
                </div>
              ))}
              {term.items.length === 0 ? (
                <p className="text-[11px] text-steel">Nenhum item. Adicione os equipamentos entregues.</p>
              ) : null}
            </div>
          </section>

          <section className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="label-mono text-signal">Textos do termo</div>
              {aiEnabled ? (
                <button className="btn px-2 py-1 text-[11px]" onClick={polishAll} disabled={aiBusy}>
                  {aiBusy ? <LoaderCircle size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {aiBusy ? "Refinando…" : "Refinar com IA"}
                </button>
              ) : null}
            </div>
            <div className="mt-3 space-y-3">
              {TEXT_FIELDS.map((f) => (
                <Field key={f.key} label={f.label} hint={f.hint}>
                  <textarea
                    className="field text-[12px] leading-relaxed"
                    rows={f.rows}
                    value={term[f.key]}
                    onChange={(e) => update({ [f.key]: e.target.value } as Partial<EditableTerm>)}
                  />
                </Field>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[10px] text-steel">{hint}</span> : null}
    </label>
  );
}
