"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, FileDown, FileText, LoaderCircle, Plus, Printer, Sparkles, Trash2 } from "lucide-react";
import { brl, fmtDate } from "@/lib/brand";
import { fetchJson } from "@/lib/api-client";
import { OS_KINDS, OS_PRIORITIES, OS_STATUSES, osStatus, soPartsCents } from "@/lib/service-orders";
import type { ServiceOrderItem } from "@/db/schema";
import {
  ServiceOrderDocument,
  type ServiceOrderDocData,
  type ServiceOrderDocSettings,
} from "@/components/os/ServiceOrderDocument";

export type EditableOs = ServiceOrderDocData & {
  id: string;
  originProposalId: string | null;
  budgetProposalId: string | null;
  budgetTotalCents: number;
  budgetIssuedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const uid = () => `os-${Math.random().toString(36).slice(2, 9)}`;
const dateInput = (value: string | Date | null) => {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

export function ServiceOrderEditor({
  initial,
  settings,
}: {
  initial: EditableOs;
  settings: ServiceOrderDocSettings;
}) {
  const router = useRouter();
  const [os, setOs] = useState<EditableOs>(initial);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [budgetBusy, setBudgetBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const parts = soPartsCents(os);
  const status = osStatus(os.status);

  function update(patch: Partial<EditableOs>) {
    setOs((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

  function patchItem(id: string, patch: Partial<ServiceOrderItem>) {
    setOs((prev) => ({ ...prev, items: prev.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    setDirty(true);
  }

  async function save(extra?: Partial<EditableOs>) {
    setSaving(true);
    setError("");
    try {
      const payload = {
        clientName: os.clientName,
        contact: os.contact,
        phone: os.phone,
        email: os.email,
        site: os.site,
        kind: os.kind,
        status: os.status,
        priority: os.priority,
        technician: os.technician,
        scheduledAt: os.scheduledAt,
        description: os.description,
        diagnosis: os.diagnosis,
        solution: os.solution,
        notes: os.notes,
        clientSignature: os.clientSignature,
        laborCents: os.laborCents,
        travelCents: os.travelCents,
        items: os.items,
        ...extra,
      };
      const data = await fetchJson<{ serviceOrder: EditableOs }>(`/api/service-orders/${os.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setOs((prev) => ({ ...prev, ...data.serviceOrder, ...extra }));
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString("pt-BR"));
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar a OS.");
      setSavedAt("erro ao salvar");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(next: string) {
    update({ status: next });
    await save({ status: next });
  }

  async function generateBudget(regenerate = false) {
    setBudgetBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await fetchJson<{ proposalId: string; proposalNumber: string; totalCents: number; reused?: boolean; message: string }>(
        `/api/service-orders/${os.id}/budget`,
        { method: "POST", body: JSON.stringify({ regenerate }) },
      );
      setNotice(data.message);
      if (data.reused) {
        router.push(`/propostas/${data.proposalId}`);
        return;
      }
      update({
        budgetProposalId: data.proposalId,
        budgetProposalNumber: data.proposalNumber,
        budgetTotalCents: data.totalCents,
        status: os.status === "aguardando_orcamento" || os.status === "aberta" ? "aguardando_aprovacao" : os.status,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar o orçamento.");
    } finally {
      setBudgetBusy(false);
    }
  }

  async function unlinkBudget() {
    if (!window.confirm("Remover o vínculo com este orçamento? A proposta não será apagada.")) return;
    try {
      await fetchJson(`/api/service-orders/${os.id}/budget`, { method: "DELETE" });
      update({ budgetProposalId: null, budgetProposalNumber: null, budgetTotalCents: 0, budgetIssuedAt: null });
      setNotice("Vínculo removido. A proposta de orçamento foi preservada em Propostas.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao remover o vínculo.");
    }
  }

  async function remove() {
    if (!window.confirm(`Excluir a OS ${os.number}? A proposta de orçamento, se existir, será preservada.`)) return;
    try {
      await fetchJson(`/api/service-orders/${os.id}`, { method: "DELETE" });
      router.push("/os");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir.");
    }
  }

  async function downloadPdf() {
    setPdfBusy(true);
    setError("");
    try {
      const [{ jsPDF }, pdfKit] = await Promise.all([import("jspdf"), import("@/lib/pdf-documents")]);
      const logo = await pdfKit.loadBrandLogo();
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      pdfKit.renderServiceOrderPdf(pdf, os, settings, logo);
      pdf.save(`${os.number}-${os.clientName.replace(/\s+/g, "-")}.pdf`);
    } catch (err) {
      console.error(err);
      setError("Não foi possível gerar o PDF. Tente novamente ou use a impressão do navegador.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-abyss">
      <header className="no-print sticky top-0 z-30 border-b border-line/60 bg-abyss/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/os" className="btn px-2.5 py-1.5 text-[11px]">←</Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] tracking-[0.18em] text-signal">{os.number}</span>
                <span className="chip">{OS_KINDS.find((k) => k.id === os.kind)?.label ?? os.kind}</span>
                {os.originProposalNumber ? <span className="chip">Origem {os.originProposalNumber}</span> : null}
                {os.budgetProposalNumber ? <span className="chip !border-signal/50 !text-signal">Orçamento {os.budgetProposalNumber}</span> : null}
              </div>
              <h1 className="truncate font-display text-[17px] font-semibold text-white">{os.clientName}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`hidden text-[11px] sm:block ${dirty ? "text-amber" : "text-steel"}`}>
              {dirty ? "Alterações não salvas" : savedAt ? `Salvo ${savedAt}` : "Tudo salvo"}
            </span>
            <select className="field w-auto py-1.5 text-[12px]" value={os.status} onChange={(e) => void changeStatus(e.target.value)}>
              {OS_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button className="btn btn-primary" onClick={downloadPdf} disabled={pdfBusy}>
              {pdfBusy ? <LoaderCircle size={14} className="animate-spin" /> : <FileDown size={14} />} PDF
            </button>
            <button className="btn" onClick={() => window.print()}>
              <Printer size={14} /> Imprimir
            </button>
            <button className="btn !border-alarm/40 !text-alarm" onClick={remove}>
              <Trash2 size={14} /> Excluir
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line/40 px-4 py-2 text-[11.5px] lg:px-6">
          <span className={`chip ${status.tone}`}>{status.label}</span>
          <span className="text-steel">{status.hint}</span>
          <span className="ml-auto text-steel">Peças {brl(parts.partsCents / 100)} · Mão de obra {brl(parts.laborCents / 100)} · Deslocamento {brl(parts.travelCents / 100)}</span>
          <span className="font-display text-[14px] font-semibold text-signal">{brl(parts.totalCents / 100)}</span>
        </div>
      </header>

      {error ? <div role="alert" className="mx-4 mt-3 rounded-lg border border-alarm/35 bg-alarm/5 p-3 text-[12px] text-alarm lg:mx-6">{error}</div> : null}
      {notice ? <div role="status" className="mx-4 mt-3 rounded-lg border border-signal/30 bg-signal/5 p-3 text-[12px] text-silver lg:mx-6">{notice}</div> : null}

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_430px] lg:p-6">
        <div className="print-area scroll-thin overflow-x-auto rounded-xl border border-line/50 bg-[#0b1728] p-4">
          <div className="mx-auto w-[794px]">
            <ServiceOrderDocument
              os={os}
              settings={settings}
              edit={{ patch: (patch) => update(patch as Partial<EditableOs>), item: patchItem }}
            />
          </div>
        </div>

        <aside className="no-print space-y-3">
          {/* ORÇAMENTO VINCULADO */}
          <section className={`rounded-xl border p-3 ${os.budgetProposalId ? "border-signal/40 bg-signal/5" : "border-line/60 bg-navy/30"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="label-mono text-signal">Orçamento da OS</div>
              {os.budgetProposalId ? <span className="chip !border-signal/50 !text-signal">vinculado</span> : <span className="chip">não emitido</span>}
            </div>

            {os.budgetProposalId ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={`/propostas/${os.budgetProposalId}`} className="font-mono text-[12.5px] text-signal hover:underline">
                    {os.budgetProposalNumber}
                  </Link>
                  <span className="font-display text-[16px] font-semibold text-white">{brl(os.budgetTotalCents / 100)}</span>
                </div>
                {os.budgetIssuedAt ? <div className="text-[10.5px] text-steel">Emitido em {fmtDate(os.budgetIssuedAt)}</div> : null}
                <p className="text-[11px] leading-relaxed text-steel">
                  O orçamento é uma proposta normal: corrija itens, textos e valores no editor. Ao salvar, o valor desta OS
                  é atualizado automaticamente.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Link href={`/propostas/${os.budgetProposalId}`} className="btn btn-primary px-2.5 py-1.5 text-[11px]">
                    <FileText size={12} /> Corrigir orçamento
                  </Link>
                  <button className="btn px-2.5 py-1.5 text-[11px]" onClick={() => void generateBudget(true)} disabled={budgetBusy}>
                    {budgetBusy ? <LoaderCircle size={12} className="animate-spin" /> : null} Nova versão
                  </button>
                  <button className="btn px-2.5 py-1.5 text-[11px] !text-alarm" onClick={unlinkBudget}>
                    Desvincular
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-[11.5px] leading-relaxed text-steel">
                  Gere uma proposta com as peças cobráveis, mão de obra e deslocamento. O documento é criado já vinculado a esta
                  OS para correção e envio ao cliente.
                </p>
                <button
                  className="btn btn-primary w-full py-2.5"
                  onClick={() => void generateBudget(false)}
                  disabled={budgetBusy || parts.totalCents <= 0}
                >
                  {budgetBusy ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {budgetBusy ? "Gerando orçamento…" : "Gerar orçamento vinculado"}
                </button>
                {parts.totalCents <= 0 ? (
                  <p className="text-[10.5px] text-amber">Inclua peças cobráveis, mão de obra ou deslocamento para gerar o orçamento.</p>
                ) : null}
              </div>
            )}
          </section>

          <Panel title="Dados da OS">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Cliente">
                <input className="field" value={os.clientName} onChange={(e) => update({ clientName: e.target.value })} />
              </Field>
              <Field label="Técnico">
                <input className="field" value={os.technician} onChange={(e) => update({ technician: e.target.value })} />
              </Field>
              <Field label="Contato">
                <input className="field" value={os.contact ?? ""} onChange={(e) => update({ contact: e.target.value })} />
              </Field>
              <Field label="Telefone">
                <input className="field" value={os.phone ?? ""} onChange={(e) => update({ phone: e.target.value })} />
              </Field>
              <Field label="E-mail">
                <input className="field" value={os.email ?? ""} onChange={(e) => update({ email: e.target.value })} />
              </Field>
              <Field label="Agendada para">
                <input
                  type="date"
                  className="field"
                  value={dateInput(os.scheduledAt)}
                  onChange={(e) => update({ scheduledAt: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })}
                />
              </Field>
              <Field label="Tipo">
                <select className="field" value={os.kind} onChange={(e) => update({ kind: e.target.value })}>
                  {OS_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>{k.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Prioridade">
                <select className="field" value={os.priority} onChange={(e) => update({ priority: e.target.value })}>
                  {OS_PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Local do atendimento">
              <input className="field" value={os.site ?? ""} onChange={(e) => update({ site: e.target.value })} />
            </Field>
          </Panel>

          <Panel title={`Checklist de execução (${os.items.filter((i) => i.checked).length}/${os.items.length})`}>
            <div className="space-y-2">
              {os.items.map((item) => (
                <div key={item.id} className="rounded-lg border border-line/60 bg-abyss2/50 p-2">
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => patchItem(item.id, { checked: !item.checked })}
                      className={`mt-0.5 shrink-0 ${item.checked ? "text-armed" : "text-steel"}`}
                      title={item.checked ? "Desmarcar" : "Conferido"}
                    >
                      <CheckCircle2 size={17} />
                    </button>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <input className="field text-[12px]" value={item.desc} onChange={(e) => patchItem(item.id, { desc: e.target.value })} />
                      <div className="grid grid-cols-4 gap-1.5">
                        <input className="field text-[11px]" value={item.unit} onChange={(e) => patchItem(item.id, { unit: e.target.value })} />
                        <input type="number" min={0} className="field text-[11px]" value={item.qty} onChange={(e) => patchItem(item.id, { qty: Number(e.target.value) })} />
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="field text-[11px]"
                          value={item.priceCents / 100}
                          onChange={(e) => patchItem(item.id, { priceCents: Math.round(Number(e.target.value) * 100) })}
                        />
                        <label className="flex items-center gap-1 text-[10px] text-steel">
                          <input type="checkbox" checked={item.billable} onChange={(e) => patchItem(item.id, { billable: e.target.checked })} />
                          cobrar
                        </label>
                      </div>
                      <input className="field text-[11px]" value={item.obs} onChange={(e) => patchItem(item.id, { obs: e.target.value })} placeholder="Observação / nº de série" />
                    </div>
                    <button className="shrink-0 text-[11px] text-alarm" onClick={() => setOs((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== item.id) }))}>
                      remover
                    </button>
                  </div>
                </div>
              ))}
              {os.items.length === 0 ? <p className="text-[11px] text-steel">Nenhum item. Adicione peças ou checkpoints.</p> : null}
            </div>
            <button
              className="btn mt-2 w-full text-[11px]"
              onClick={() => setOs((prev) => ({ ...prev, items: [...prev.items, { id: uid(), desc: "Novo item", spec: "", unit: "un", qty: 1, priceCents: 0, scope: "Peças e materiais", billable: true, checked: false, obs: "" }] }))}
            >
              <Plus size={12} /> Adicionar item
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="Mão de obra (R$)">
                <input type="number" min={0} step={10} className="field" value={os.laborCents / 100} onChange={(e) => update({ laborCents: Math.round(Number(e.target.value) * 100) })} />
              </Field>
              <Field label="Deslocamento (R$)">
                <input type="number" min={0} step={10} className="field" value={os.travelCents / 100} onChange={(e) => update({ travelCents: Math.round(Number(e.target.value) * 100) })} />
              </Field>
            </div>
          </Panel>

          <Panel title="Laudo técnico" hint="Alimenta o orçamento gerado">
            <Field label="Diagnóstico">
              <textarea className="field min-h-[70px]" value={os.diagnosis} onChange={(e) => update({ diagnosis: e.target.value })} />
            </Field>
            <Field label="Solução executada">
              <textarea className="field min-h-[70px]" value={os.solution} onChange={(e) => update({ solution: e.target.value })} />
            </Field>
            <Field label="Observações ao cliente">
              <textarea className="field min-h-[60px]" value={os.notes} onChange={(e) => update({ notes: e.target.value })} />
            </Field>
            <Field label="Recebedor do serviço">
              <input className="field" value={os.clientSignature} onChange={(e) => update({ clientSignature: e.target.value })} placeholder="Nome de quem conferiu" />
            </Field>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line/60 bg-navy/30 p-3">
      <div className="label-mono text-signal">{title}</div>
      {hint ? <p className="mt-1 text-[10.5px] leading-relaxed text-steel">{hint}</p> : null}
      <div className="mt-2.5 space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-mono mb-1 block">{label}</span>
      {children}
    </label>
  );
}
