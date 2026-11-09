"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/ui/Logo";

export type SettingsFormValues = {
  id: string;
  companyName: string;
  legalName: string;
  tagline: string;
  director: string;
  role: string;
  phone: string;
  landline: string;
  email: string;
  site: string;
  address: string;
  cnpj: string;
  crea: string;
  hours: string;
  defaultValidityDays: number;
  defaultPaymentTerms: string;
  defaultDeliveryTime: string;
  defaultWarranty: string;
};

export function SettingsForm({ initial }: { initial: SettingsFormValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  const identity: [keyof SettingsFormValues, string][] = [
    ["companyName", "Nome da marca"],
    ["legalName", "Razão social"],
    ["tagline", "Assinatura / tagline"],
    ["director", "Responsável técnico"],
    ["role", "Cargo"],
    ["crea", "Registro CREA"],
    ["cnpj", "CNPJ"],
    ["phone", "WhatsApp / celular"],
    ["landline", "Telefone fixo"],
    ["email", "E-mail comercial"],
    ["site", "Site"],
    ["address", "Endereço"],
    ["hours", "Horário de atendimento"],
  ];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-3">
        <section className="card p-4">
          <div className="label-mono text-signal">Papel timbrado</div>
          <h2 className="font-display text-[15px] font-semibold text-white">Dados que aparecem nas propostas</h2>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {identity.map(([key, label]) => (
              <label key={key} className={`block ${key === "tagline" || key === "address" ? "sm:col-span-2" : ""}`}>
                <span className="label-mono mb-1 block">{label}</span>
                <input
                  className="field"
                  value={String(values[key])}
                  onChange={(e) => set(key, e.target.value as SettingsFormValues[typeof key])}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="card p-4">
          <div className="label-mono text-signal">Padrões comerciais</div>
          <h2 className="font-display text-[15px] font-semibold text-white">Condições aplicadas às novas propostas</h2>
          <div className="mt-3 grid gap-2.5">
            <label className="block max-w-[160px]">
              <span className="label-mono mb-1 block">Validade (dias)</span>
              <input
                type="number"
                className="field"
                value={values.defaultValidityDays}
                onChange={(e) => set("defaultValidityDays", Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className="label-mono mb-1 block">Pagamento</span>
              <textarea className="field min-h-[60px]" value={values.defaultPaymentTerms} onChange={(e) => set("defaultPaymentTerms", e.target.value)} />
            </label>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className="label-mono mb-1 block">Prazo de entrega</span>
                <input className="field" value={values.defaultDeliveryTime} onChange={(e) => set("defaultDeliveryTime", e.target.value)} />
              </label>
              <label className="block">
                <span className="label-mono mb-1 block">Garantia</span>
                <input className="field" value={values.defaultWarranty} onChange={(e) => set("defaultWarranty", e.target.value)} />
              </label>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Salvando…" : "Salvar identidade e padrões"}
          </button>
          {saved ? <span className="text-[11.5px] text-armed">Aplicado às próximas propostas.</span> : null}
        </div>
      </div>

      <aside className="space-y-3">
        <section className="card overflow-hidden">
          <div style={{ background: "#0A192F", padding: 16 }}>
            <Logo height={40} />
            <div style={{ fontSize: 9, color: "#7D93AD", marginTop: 8, maxWidth: 220, lineHeight: 1.4 }}>
              {values.tagline}
            </div>
          </div>
          <div style={{ height: 3, background: "linear-gradient(90deg,#00E5FF,#2F80FF)" }} />
          <div className="p-3">
            <div className="label-mono">Rodapé do documento</div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-steel">
              {values.legalName} · CNPJ {values.cnpj} · {values.crea}
              <br />
              {values.address}
              <br />
              {values.phone} · {values.email} · {values.site}
            </p>
          </div>
        </section>

        <section className="card p-3">
          <div className="label-mono text-signal">Sistema de identidade</div>
          <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-steel">
            <p><b className="text-silver">Paleta:</b> Navy #0A192F, Ciano #00E5FF, Azul rede #2F80FF, Prata #C6D2E0.</p>
            <p><b className="text-silver">Tipografia:</b> Space Grotesk (display), IBM Plex Sans (texto), IBM Plex Mono (dados).</p>
            <p><b className="text-silver">Regra de escrita:</b> números antes de adjetivos, especificação em vez de superlativo.</p>
          </div>
        </section>
      </aside>
    </div>
  );
}
