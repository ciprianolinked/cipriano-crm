"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type ClientRecord = {
  id: string;
  name: string;
  company: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  document: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  segment: string | null;
  source: string | null;
  notes: string | null;
  proposals: number;
  pipelineCents: number;
};

const emptyForm = {
  name: "",
  company: "",
  contactName: "",
  email: "",
  phone: "",
  document: "",
  address: "",
  city: "",
  state: "SP",
  segment: "Condomínio residencial",
  source: "",
  notes: "",
};

type FormState = typeof emptyForm;

export function ClientManager({ clients }: { clients: ClientRecord[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = clients.filter((c) =>
    [c.name, c.company, c.city, c.segment, c.contactName].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()),
  );

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!form.name.trim()) return;
    setBusy(true);
    const res = await fetch(editingId ? `/api/clients/${editingId}` : "/api/clients", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (res.ok) {
      setForm(emptyForm);
      setEditingId(null);
      setOpen(false);
      router.refresh();
    }
  }

  function edit(client: ClientRecord) {
    setEditingId(client.id);
    setOpen(true);
    setForm({
      name: client.name,
      company: client.company ?? "",
      contactName: client.contactName ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      document: client.document ?? "",
      address: client.address ?? "",
      city: client.city ?? "",
      state: client.state ?? "",
      segment: client.segment ?? "",
      source: client.source ?? "",
      notes: client.notes ?? "",
    });
  }

  async function remove(id: string) {
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className="field max-w-[300px]" placeholder="Buscar por nome, cidade, segmento…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button
          className="btn btn-primary"
          onClick={() => {
            setOpen((v) => !v);
            setEditingId(null);
            setForm(emptyForm);
          }}
        >
          {open ? "Fechar cadastro" : "+ Cadastrar cliente"}
        </button>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-steel">{filtered.length} clientes</span>
      </div>

      {open ? (
        <section className="card p-4">
          <div className="label-mono text-signal">{editingId ? "Editar cliente" : "Novo cliente"}</div>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["name", "Nome do cliente *"],
                ["company", "Razão social"],
                ["contactName", "Contato / cargo"],
                ["email", "E-mail"],
                ["phone", "Telefone / WhatsApp"],
                ["document", "CNPJ / CPF"],
                ["address", "Endereço"],
                ["city", "Cidade"],
                ["state", "UF"],
                ["segment", "Segmento"],
                ["source", "Origem do lead"],
              ] as [keyof FormState, string][]
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="label-mono mb-1 block">{label}</span>
                <input className="field" value={form[key]} onChange={(e) => set(key, e.target.value)} />
              </label>
            ))}
            <label className="block sm:col-span-2 lg:col-span-3">
              <span className="label-mono mb-1 block">Notas comerciais</span>
              <textarea className="field min-h-[64px]" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? "Salvando…" : editingId ? "Salvar cliente" : "Cadastrar cliente"}
            </button>
            <Link href="/propostas/nova" className="btn">
              Ir para proposta
            </Link>
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((client) => (
          <article key={client.id} className="card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-display text-[13.5px] font-semibold text-white">{client.name}</h3>
                <p className="truncate text-[10.5px] text-steel">{client.company || client.segment || "—"}</p>
              </div>
              <span className="chip shrink-0">{client.proposals} prop.</span>
            </div>
            <div className="mt-2 space-y-0.5 text-[11px] text-silver">
              {client.contactName ? <p>{client.contactName}</p> : null}
              {client.phone ? <p className="text-steel">{client.phone}</p> : null}
              {client.email ? <p className="truncate text-steel">{client.email}</p> : null}
              {client.city ? (
                <p className="text-steel">
                  {client.address ? `${client.address} · ` : ""}
                  {client.city}/{client.state}
                </p>
              ) : null}
            </div>
            {client.notes ? <p className="mt-2 line-clamp-2 text-[10.5px] leading-snug text-steel">{client.notes}</p> : null}
            <div className="mt-2 flex items-center justify-between border-t border-line/40 pt-2">
              <span className="font-mono text-[9.5px] tracking-[0.1em] text-signal">
                {(client.pipelineCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
              <div className="flex gap-2 text-[10.5px]">
                <button className="text-steel hover:text-silver" onClick={() => edit(client)}>
                  editar
                </button>
                <button className="text-steel hover:text-alarm" onClick={() => remove(client.id)}>
                  excluir
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
