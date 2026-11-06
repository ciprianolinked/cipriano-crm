"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { brl } from "@/lib/brand";
import { PRIORITIES, SEGMENTS, defaultBriefing } from "@/lib/proposal/catalog";
import { PROPOSAL_TYPES, type Briefing, type ProposalDraft, type ProposalType, type Totals } from "@/lib/proposal/types";
import type { Insight } from "@/lib/ai";

type ClientOption = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
};

type PreviewResponse = {
  draft: ProposalDraft;
  totals: Totals;
  insights: Insight[];
  aiNote: string;
  error?: string;
};

const PRESETS: { label: string; briefing: Briefing; type: ProposalType }[] = [
  {
    label: "Condomínio · 8 câmeras + acesso",
    type: "completa",
    briefing: { ...defaultBriefing, cameras: 8, doors: 2, fenceMeters: 60, monitoring: true },
  },
  {
    label: "Indústria · 16 câmeras + ART",
    type: "completa",
    briefing: {
      ...defaultBriefing,
      segment: "Indústria / galpão",
      cameras: 16,
      doors: 4,
      fenceMeters: 120,
      alarm: true,
      monitoring: true,
      maintenance: true,
      priority: "tecnica",
    },
  },
  {
    label: "Loja · 4 câmeras (rápida)",
    type: "simples",
    briefing: { ...defaultBriefing, segment: "Varejo / loja", cameras: 4, doors: 1, fenceMeters: 0, monitoring: false },
  },
  {
    label: "Reposição de produtos",
    type: "produtos_servicos",
    briefing: { ...defaultBriefing, segment: "Varejo / loja", cameras: 3, doors: 0, fenceMeters: 0, monitoring: false, maintenance: false, priority: "orcamento" },
  },
];

export function NewProposalWizard({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [type, setType] = useState<ProposalType>("completa");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [contact, setContact] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [site, setSite] = useState("");
  const [validityDays, setValidityDays] = useState(15);
  const [artIncluded, setArtIncluded] = useState(true);
  const [briefing, setBriefing] = useState<Briefing>(defaultBriefing);
  const [rawNotes, setRawNotes] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  function applyClient(id: string) {
    setClientId(id);
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    setClientName(client.name);
    setContact(client.contactName ?? "");
    setClientEmail(client.email ?? "");
    setSite([client.address, client.city && client.state ? `${client.city}/${client.state}` : client.city].filter(Boolean).join(" — "));
  }

  function applyPreset(index: number) {
    const preset = PRESETS[index];
    setType(preset.type);
    setBriefing(preset.briefing);
    setArtIncluded(preset.type === "completa");
    setPreview(null);
  }

  function num(key: keyof Briefing, value: number) {
    setBriefing((prev) => ({ ...prev, [key]: Math.max(0, value) }));
    setPreview(null);
  }

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          briefing: { ...briefing, rawNotes },
          clientName,
          contact,
          clientEmail,
          site,
          validityDays,
          artIncluded,
        }),
      });
      const data = (await res.json()) as PreviewResponse;
      setPreview(data);
    } finally {
      setLoading(false);
    }
  }

  async function createProposal(status: "novo" | "enviada") {
    if (!preview) return;
    setSaving(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          clientId: clientId || null,
          clientName,
          contact,
          clientEmail,
          site,
          status,
          draft: { ...preview.draft, briefing },
        }),
      });
      const data = (await res.json()) as { proposal?: { id: string }; error?: string };
      if (data.proposal) router.push(`/propostas/${data.proposal.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        <section className="card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="label-mono text-signal">Etapa 1</div>
              <h2 className="font-display text-lg font-semibold text-white">Escolha o formato</h2>
            </div>
            <span className="text-[11px] text-steel">Comece pelo template, ajuste depois no editor.</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PROPOSAL_TYPES.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  setType(option.id);
                  setArtIncluded(option.id === "completa");
                  setPreview(null);
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  type === option.id
                    ? "border-signal/60 bg-signal/10"
                    : "border-line/60 bg-abyss2/40 hover:border-signal/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-[13px] font-semibold text-white">{option.short}</span>
                  {type === option.id ? <span className="text-signal">●</span> : null}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-steel">{option.description}</p>
                <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-signal/80">{option.pages}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="label-mono mr-1 py-1">Atalhos:</span>
            {PRESETS.map((preset, i) => (
              <button key={preset.label} onClick={() => applyPreset(i)} className="chip hover:border-signal/50 hover:text-signal">
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card p-4">
          <div className="label-mono text-signal">Etapa 2</div>
          <h2 className="font-display text-lg font-semibold text-white">Cliente e local</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label-mono mb-1 block">Cliente cadastrado</span>
              <select className="field" value={clientId} onChange={(e) => applyClient(e.target.value)}>
                <option value="">Novo cliente / digitar abaixo</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label-mono mb-1 block">Nome do cliente *</span>
              <input className="field" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome do cliente" />
            </label>
            <label className="block">
              <span className="label-mono mb-1 block">Contato / cargo</span>
              <input className="field" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contato · cargo" />
            </label>
            <label className="block">
              <span className="label-mono mb-1 block">E-mail</span>
              <input className="field" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="contato@cliente.com.br" />
            </label>
            <label className="block">
              <span className="label-mono mb-1 block">Local da instalação</span>
              <input className="field" value={site} onChange={(e) => setSite(e.target.value)} placeholder="Rua, número — bairro, cidade/UF" />
            </label>
            <label className="block">
              <span className="label-mono mb-1 block">Validade (dias)</span>
              <input type="number" className="field" value={validityDays} onChange={(e) => setValidityDays(Number(e.target.value))} />
            </label>
            <label className="flex items-end gap-2 pb-2 text-[12px] text-silver">
              <input type="checkbox" checked={artIncluded} onChange={(e) => setArtIncluded(e.target.checked)} />
              Incluir ART, projeto executivo e as-built
            </label>
          </div>
        </section>

        <section className="card p-4">
          <div className="label-mono text-signal">Etapa 3</div>
          <h2 className="font-display text-lg font-semibold text-white">Briefing em 60 segundos</h2>
          <p className="text-[11px] text-steel">
            Números definem escopo, itens e valor. A IA completa o texto técnico e sugere cláusulas.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["cameras", "Câmeras IP"],
                ["doors", "Portas com acesso"],
                ["fenceMeters", "Perímetro (m)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="label-mono mb-1 block">{label}</span>
                <input
                  type="number"
                  min={0}
                  className="field"
                  value={briefing[key]}
                  onChange={(e) => num(key, Number(e.target.value))}
                />
              </label>
            ))}
            <label className="block">
              <span className="label-mono mb-1 block">Segmento</span>
              <select
                className="field"
                value={briefing.segment}
                onChange={(e) => setBriefing((p) => ({ ...p, segment: e.target.value }))}
              >
                {SEGMENTS.map((segment) => (
                  <option key={segment} value={segment}>
                    {segment}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(
              [
                ["monitoring", "Monitoramento NOC 24h"],
                ["alarm", "Alarme monitorado"],
                ["intercom", "Interfonia IP"],
                ["network", "Rede / rack"],
                ["maintenance", "Manutenção preventiva"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setBriefing((prev) => ({ ...prev, [key]: !prev[key] }));
                  setPreview(null);
                }}
                className={`chip ${briefing[key] ? "border-signal/60 bg-signal/10 text-signal" : ""}`}
              >
                {briefing[key] ? "✓ " : "+ "}
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label-mono mb-1 block">Prioridade do cliente</span>
              <select
                className="field"
                value={briefing.priority}
                onChange={(e) => setBriefing((p) => ({ ...p, priority: e.target.value as Briefing["priority"] }))}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[10.5px] text-steel">
                {PRIORITIES.find((p) => p.id === briefing.priority)?.hint}
              </span>
            </label>
            <label className="block">
              <span className="label-mono mb-1 block">Texto livre (cole do WhatsApp)</span>
              <textarea
                className="field min-h-[64px]"
                value={rawNotes}
                onChange={(e) => {
                  setRawNotes(e.target.value);
                  setPreview(null);
                }}
                placeholder="Ex.: condomínio quer 10 câmeras, 2 portas com facial, 80 m de cerca e monitoramento 24h, urgente."
              />
            </label>
          </div>
          <p className="mt-2 text-[10.5px] text-steel">
            A IA lê o texto livre e extrai quantidades, tecnologias e prioridade — evita redigitar briefing.
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={generate} disabled={loading || !clientName.trim()}>
            {loading ? "Montando proposta…" : "Gerar proposta com IA"}
          </button>
          <Link href="/propostas" className="btn">
            Cancelar
          </Link>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="label-mono text-signal">Prévia inteligente</span>
            <span className="chip">{PROPOSAL_TYPES.find((t) => t.id === type)?.short}</span>
          </div>
          {!preview ? (
            <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-steel">
              <p>
                O motor Cipriano monta o documento com <b className="text-silver">itens do catálogo</b>, escopo técnico,
                normas, aterramento, matriz de responsabilidade e condições padrão.
              </p>
              <ul className="space-y-1.5">
                {[
                  "Outorga e ART automáticas quando o projeto é de maior valor",
                  "Desconto sugerido por volume (3% a 10%)",
                  "Alerta de upsell de NOC e manutenção",
                  "Follow-up D+2 criado ao enviar",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-signal">▸</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-line/60 bg-abyss2/60 p-3">
                <div className="label-mono">Investimento total</div>
                <div className="font-display text-2xl font-bold text-signal">{brl(preview.totals.totalCents / 100)}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-steel">
                  <span>{preview.draft.items.length} itens</span>
                  <span>desconto {preview.draft.discountPct}%</span>
                  <span>12× {brl(preview.totals.installmentCents / 100)}</span>
                </div>
              </div>
              <div>
                <div className="label-mono mb-1">Leitura do consultor</div>
                <div className="space-y-1.5">
                  {preview.insights.map((insight) => (
                    <div
                      key={insight.title}
                      className={`rounded-lg border p-2 ${
                        insight.tone === "danger"
                          ? "border-alarm/40 bg-alarm/5"
                          : insight.tone === "warn"
                            ? "border-amber/40 bg-amber/5"
                            : insight.tone === "ok"
                              ? "border-armed/40 bg-armed/5"
                              : "border-network/40 bg-network/5"
                      }`}
                    >
                      <div className="text-[11.5px] font-medium text-silver">{insight.title}</div>
                      <p className="text-[10.5px] leading-snug text-steel">{insight.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-line/60 bg-navy/30 p-2 text-[10.5px] leading-relaxed text-steel">
                {preview.aiNote}
              </div>
              <div className="space-y-2">
                <div className="label-mono">Blocos gerados ({preview.draft.sections.filter((s) => s.enabled).length})</div>
                <div className="flex flex-wrap gap-1">
                  {preview.draft.sections.filter((s) => s.enabled).map((section) => (
                    <span key={section.id} className="chip">
                      {section.title}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <button className="btn btn-primary" onClick={() => createProposal("enviada")} disabled={saving}>
                  {saving ? "Criando…" : "Criar e marcar como enviada"}
                </button>
                <button className="btn" onClick={() => createProposal("novo")} disabled={saving}>
                  Salvar como rascunho
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card p-4">
          <div className="label-mono mb-2 text-signal">Como economizar tempo</div>
          <ul className="space-y-2 text-[11.5px] leading-relaxed text-steel">
            <li>• Reaproveite propostas anteriores com “Duplicar” e ajuste só o cliente e as quantidades.</li>
            <li>• Use os atalhos de briefing: 80% dos seus projetos partem de 4 configurações.</li>
            <li>• Mantenha o catálogo atualizado — o valor e a tabela saem sem redigitar especificação.</li>
            <li>• Envie sempre com follow-up D+2 agendado: é onde a maioria dos negócios fecha.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
