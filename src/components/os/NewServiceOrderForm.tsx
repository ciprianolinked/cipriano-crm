"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, LoaderCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { brl } from "@/lib/brand";
import { fetchJson } from "@/lib/api-client";
import { useLiveList } from "@/lib/use-live-list";
import { OS_KINDS, OS_PRIORITIES, OS_STATUSES } from "@/lib/service-orders";
import type { ServiceOrderItem } from "@/db/schema";

type ClientOption = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
};
type CatalogOption = { id: string; category: string; description: string; spec: string | null; unit: string; priceCents: number; active?: boolean };
type ProposalOption = { id: string; number: string; clientName: string; site: string | null; status: string };

const uid = () => `os-${Math.random().toString(36).slice(2, 9)}`;

export function NewServiceOrderForm({
  clients: initialClients,
  catalog: initialCatalog,
  proposals,
}: {
  clients: ClientOption[];
  catalog: CatalogOption[];
  proposals: ProposalOption[];
}) {
  const router = useRouter();
  const clientsLive = useLiveList<ClientOption>("/api/clients", (d) => (d as { clients?: ClientOption[] }).clients ?? [], initialClients);
  const catalogLive = useLiveList<CatalogOption>(
    "/api/catalog",
    (d) => ((d as { items?: CatalogOption[] }).items ?? []).filter((i) => i.active !== false),
    initialCatalog.filter((i) => i.active !== false),
  );
  const clients = clientsLive.items;
  const catalog = catalogLive.items;

  const [form, setForm] = useState({
    clientId: "",
    clientName: "",
    contact: "",
    phone: "",
    email: "",
    site: "",
    kind: "corretiva",
    priority: "normal",
    status: "aberta",
    technician: "",
    scheduledAt: "",
    description: "",
    diagnosis: "",
    solution: "",
    notes: "",
    laborValue: 0,
    travelValue: 0,
  });
  const [items, setItems] = useState<ServiceOrderItem[]>([]);
  const [pick, setPick] = useState("");
  const [qty, setQty] = useState(1);
  const [originProposalId, setOriginProposalId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(patch: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function applyClient(id: string) {
    const c = clients.find((x) => x.id === id);
    if (!c) {
      update({ clientId: "", clientName: "", contact: "", phone: "", email: "", site: "" });
      return;
    }
    update({
      clientId: id,
      clientName: c.name,
      contact: c.contactName ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      site: [c.address, [c.city, c.state].filter(Boolean).join("/")].filter(Boolean).join(" — "),
    });
  }

  function addItem() {
    const product = catalog.find((c) => c.id === pick);
    if (!product) return;
    setItems((prev) => [
      ...prev,
      {
        id: uid(),
        desc: product.description,
        spec: product.spec ?? "",
        unit: product.unit,
        qty: Math.max(1, qty || 1),
        priceCents: product.priceCents,
        scope: product.category,
        billable: true,
        checked: false,
        obs: "",
      },
    ]);
    setPick("");
    setQty(1);
  }

  function patchItem(id: string, patch: Partial<ServiceOrderItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function submit() {
    setError("");
    if (!form.clientName.trim()) {
      setError("Informe o cliente.");
      return;
    }
    if (!form.description.trim() && items.length === 0) {
      setError("Descreva o serviço ou inclua ao menos uma peça/material.");
      return;
    }
    setBusy(true);
    try {
      const data = await fetchJson<{ serviceOrder: { id: string } }>("/api/service-orders", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          scheduledAt: form.scheduledAt ? new Date(`${form.scheduledAt}T12:00:00`).toISOString() : null,
          items,
          laborCents: Math.round((Number(form.laborValue) || 0) * 100),
          travelCents: Math.round((Number(form.travelValue) || 0) * 100),
          originProposalId: originProposalId || null,
        }),
      });
      router.push(`/os/${data.serviceOrder.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao abrir a OS.");
      setBusy(false);
    }
  }

  const billableTotal = items.filter((i) => i.billable).reduce((sum, i) => sum + i.priceCents * i.qty, 0);
  const total = billableTotal + Math.round((Number(form.laborValue) || 0) * 100) + Math.round((Number(form.travelValue) || 0) * 100);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <section className="card p-5">
          <div className="label-mono text-signal">1 · Origem</div>
          <h2 className="mt-1 font-display text-[15px] font-semibold text-white">A OS nasce de uma proposta?</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-steel">
            Opcional. Ao vincular, cliente, local e itens da proposta vêm preenchidos como checklist de execução
            (sem cobrança duplicada — o orçamento da OS cobre apenas o que for novo).
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label-mono mb-1.5 block">Proposta de origem</span>
              <select className="field" value={originProposalId} onChange={(e) => setOriginProposalId(e.target.value)}>
                <option value="">OS sem proposta vinculada</option>
                {proposals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number} · {p.clientName} ({p.status})
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-lg border border-line/50 bg-abyss2/40 p-2.5 text-[11px] leading-relaxed text-steel">
              O vínculo é gravado na OS. Na proposta você também vê “Orçamento de OS” quando ela for a origem do serviço.
            </div>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="label-mono text-signal">2 · Cliente e local</div>
              <h2 className="mt-1 font-display text-[15px] font-semibold text-white">Para quem é o atendimento?</h2>
            </div>
            <button type="button" className="btn px-2 py-1 text-[10.5px]" onClick={() => void clientsLive.refresh()}>
              <RefreshCw size={11} className={clientsLive.refreshing ? "animate-spin" : ""} /> Atualizar clientes
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label-mono mb-1.5 block">Cliente cadastrado</span>
              <select className="field" value={form.clientId} onChange={(e) => applyClient(e.target.value)}>
                <option value="">Digitar manualmente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Cliente *">
              <input className="field" value={form.clientName} onChange={(e) => update({ clientName: e.target.value })} />
            </Field>
            <Field label="Contato">
              <input className="field" value={form.contact} onChange={(e) => update({ contact: e.target.value })} />
            </Field>
            <Field label="Telefone">
              <input className="field" value={form.phone} onChange={(e) => update({ phone: e.target.value })} />
            </Field>
            <Field label="E-mail">
              <input className="field" type="email" value={form.email} onChange={(e) => update({ email: e.target.value })} />
            </Field>
            <Field label="Local do atendimento">
              <input className="field" value={form.site} onChange={(e) => update({ site: e.target.value })} />
            </Field>
            <Field label="Técnico responsável">
              <input className="field" value={form.technician} onChange={(e) => update({ technician: e.target.value })} placeholder="Quem executa" />
            </Field>
          </div>
        </section>

        <section className="card p-5">
          <div className="label-mono text-signal">3 · Classificação e agenda</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <Field label="Tipo">
              <select className="field" value={form.kind} onChange={(e) => update({ kind: e.target.value })}>
                {OS_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>{k.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Prioridade">
              <select className="field" value={form.priority} onChange={(e) => update({ priority: e.target.value })}>
                {OS_PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Status inicial">
              <select className="field" value={form.status} onChange={(e) => update({ status: e.target.value })}>
                {OS_STATUSES.filter((s) => s.id !== "cancelada").map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Agendada para">
              <input type="date" className="field" value={form.scheduledAt} onChange={(e) => update({ scheduledAt: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="card p-5">
          <div className="label-mono text-signal">4 · Serviço</div>
          <h2 className="mt-1 font-display text-[15px] font-semibold text-white">O que precisa ser feito?</h2>
          <div className="mt-3 space-y-3">
            <Field label="Solicitação / defeito relatado *">
              <textarea className="field min-h-[70px]" value={form.description} onChange={(e) => update({ description: e.target.value })} placeholder="Ex.: câmera 4 do bloco B sem imagem desde a queda de energia." />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Diagnóstico técnico">
                <textarea className="field min-h-[60px]" value={form.diagnosis} onChange={(e) => update({ diagnosis: e.target.value })} placeholder="O que foi identificado em campo" />
              </Field>
              <Field label="Solução proposta">
                <textarea className="field min-h-[60px]" value={form.solution} onChange={(e) => update({ solution: e.target.value })} placeholder="Serviço e peças necessárias" />
              </Field>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-signal/30 bg-signal/[0.04] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="label-mono text-signal">Peças e materiais</div>
              <button type="button" className="btn px-2 py-1 text-[10.5px]" onClick={() => void catalogLive.refresh()}>
                <RefreshCw size={11} className={catalogLive.refreshing ? "animate-spin" : ""} /> Catálogo
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_90px_auto]">
              <select className="field text-[11.5px]" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Selecione um item do catálogo…</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.category}] {c.description} — {brl(c.priceCents / 100)}/{c.unit}
                  </option>
                ))}
              </select>
              <input type="number" min={1} className="field text-[11px]" value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
              <button type="button" className="btn btn-primary px-3 text-[11.5px]" onClick={addItem} disabled={!pick}>
                <Plus size={13} /> Incluir
              </button>
            </div>
            <button
              type="button"
              className="btn mt-2 w-full text-[11px]"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  { id: uid(), desc: "Peça / material avulso", spec: "", unit: "un", qty: 1, priceCents: 0, scope: "Peças e materiais", billable: true, checked: false, obs: "" },
                ])
              }
            >
              + Item avulso
            </button>
            {items.length ? (
              <div className="mt-3 space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-line/50 bg-abyss2/50 p-2">
                    <div className="flex gap-1.5">
                      <input className="field text-[11.5px]" value={item.desc} onChange={(e) => patchItem(item.id, { desc: e.target.value })} />
                      <button type="button" className="text-alarm" onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                      <input className="field text-[11px]" value={item.unit} onChange={(e) => patchItem(item.id, { unit: e.target.value })} placeholder="un" />
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
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[10.5px] text-steel">Nenhuma peça. A OS pode ser só de mão de obra ou de diagnóstico.</p>
            )}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Mão de obra (R$)">
              <input type="number" min={0} step={10} className="field" value={form.laborValue} onChange={(e) => update({ laborValue: Number(e.target.value) })} />
            </Field>
            <Field label="Deslocamento (R$)">
              <input type="number" min={0} step={10} className="field" value={form.travelValue} onChange={(e) => update({ travelValue: Number(e.target.value) })} />
            </Field>
          </div>

          <Field label="Observações">
            <textarea className="field mt-3 min-h-[60px]" value={form.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="Acesso, janela de atendimento, riscos, combinados com o cliente…" />
          </Field>
        </section>

        {error ? <div role="alert" className="rounded-lg border border-alarm/35 bg-alarm/5 p-3 text-[12px] text-alarm">{error}</div> : null}

        <div className="flex gap-2">
          <button type="button" className="btn btn-primary px-5 py-3" disabled={busy} onClick={submit}>
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            {busy ? "Abrindo OS…" : "Abrir ordem de serviço"}
          </button>
          <Link href="/os" className="btn">Cancelar</Link>
        </div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-5">
        <section className="card p-4">
          <div className="label-mono text-signal">Resumo</div>
          <div className="mt-3 space-y-1.5 text-[11.5px]">
            <Row label="Peças cobráveis" value={brl(billableTotal / 100)} />
            <Row label="Mão de obra" value={brl((Number(form.laborValue) || 0))} />
            <Row label="Deslocamento" value={brl((Number(form.travelValue) || 0))} />
            <div className="mt-2 flex items-center justify-between border-t border-line/40 pt-2">
              <span className="text-steel">Total da OS</span>
              <span className="font-display text-[18px] font-semibold text-signal">{brl(total / 100)}</span>
            </div>
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-steel">
            Nenhum orçamento é enviado ao cliente sem sua ação. Depois de abrir a OS, use “Gerar orçamento”
            para criar a proposta vinculada e corrigir valores e textos.
          </p>
        </section>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-steel">{label}</span>
      <span className="text-silver">{value}</span>
    </div>
  );
}
