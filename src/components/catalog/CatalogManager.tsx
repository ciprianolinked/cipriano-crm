"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { brl } from "@/lib/brand";
import { salePriceFromSupplier } from "@/lib/proposal/catalog";

export type CatalogRecord = {
  id: string;
  kind: string;
  category: string;
  description: string;
  spec: string | null;
  unit: string;
  supplierPriceCents: number;
  marginPct: number;
  priceCents: number;
  active: boolean;
};

type ExtractedItem = {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
};

const emptyForm = {
  kind: "equipamento",
  category: "CFTV",
  description: "",
  spec: "",
  unit: "un",
  supplierPrice: "",
  margin: "30",
};

export function CatalogManager({ items }: { items: CatalogRecord[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Anexo de fornecedor (IA).
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [extractSource, setExtractSource] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formSalePrice = salePriceFromSupplier(
    Number(form.supplierPrice || 0) * 100,
    Number(form.margin || 30),
  );

  async function saveRow(row: CatalogRecord) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          description: row.description,
          spec: row.spec,
          kind: row.kind,
          category: row.category,
          unit: row.unit,
          supplierPrice: row.supplierPriceCents / 100,
          margin: row.marginPct,
        }),
      });
      if (!res.ok) throw new Error("Falha ao salvar.");
      setSaved(row.id);
      setTimeout(() => setSaved(null), 1500);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  function patch(id: string, patch: Partial<CatalogRecord>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function startEdit(row: CatalogRecord) {
    setEditingId(row.id);
    setForm({
      kind: row.kind,
      category: row.category,
      description: row.description,
      spec: row.spec ?? "",
      unit: row.unit,
      supplierPrice: (row.supplierPriceCents / 100).toString(),
      margin: row.marginPct.toString(),
    });
  }

  async function create() {
    if (!form.description.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: form.kind,
          category: form.category,
          description: form.description,
          spec: form.spec,
          unit: form.unit,
          supplierPrice: Number(form.supplierPrice || 0),
          margin: Number(form.margin || 30),
        }),
      });
      if (!res.ok) throw new Error("Falha ao adicionar.");
      setForm({ ...emptyForm, kind: form.kind, category: form.category, margin: form.margin });
      setEditingId(null);
      setFlash("Item adicionado ao catálogo.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao adicionar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir este item do catálogo?")) return;
    setBusy(true);
    try {
      await fetch(`/api/catalog?id=${id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function extractAnexo(file: File) {
    setExtracting(true);
    setExtractError("");
    setExtractedItems([]);
    setExtractSource("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/catalog/extract", { method: "POST", body: formData });
      const data = (await res.json()) as {
        ok: boolean;
        source?: string;
        text?: string;
        items?: ExtractedItem[];
        error?: string;
      };
      if (!res.ok && !data.items?.length) throw new Error(data.error || "Falha ao analisar o anexo.");
      setExtractSource(data.source ?? "");
      setExtractedItems(data.items ?? []);
      if (!data.items?.length) {
        setExtractError(data.error || "Não identifiquei itens com preço no anexo.");
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Falha ao analisar o anexo.");
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function addExtractedToCatalog() {
    if (!extractedItems.length) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: extractedItems.map((item) => ({
            kind: "equipamento",
            category: "CFTV",
            description: item.description,
            spec: "",
            unit: item.unit || "un",
            supplierPrice: item.unitPrice,
            margin: 30,
          })),
        }),
      });
      if (!res.ok) throw new Error("Falha ao adicionar os itens.");
      setExtractedItems([]);
      setExtractSource("");
      setFlash(`${extractedItems.length} item(ns) extraído(s) adicionado(s) ao catálogo.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao adicionar os itens.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Anexo de fornecedor (IA) */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="label-mono text-signal">Inserir anexo do fornecedor</div>
            <p className="mt-1 text-[11px] leading-relaxed text-steel">
              Envie um orçamento do fornecedor (imagem, PDF ou CSV). A IA extrai os itens e adiciona ao catálogo.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void extractAnexo(file);
            }}
          />
          <button
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={extracting}
          >
            {extracting ? "Lendo anexo…" : "Selecionar anexo"}
          </button>
        </div>

        {extracting ? (
          <div className="mt-3 rounded-lg border border-line/50 bg-abyss2/40 p-4 text-center text-[12px] text-steel">
            Lendo o anexo e extraindo itens… isso pode levar alguns segundos para imagens.
          </div>
        ) : null}

        {extractError ? (
          <div className="mt-3 rounded-lg border border-amber/40 bg-amber/6 p-3 text-[11.5px] text-amber">
            {extractError}
          </div>
        ) : null}

        {extractedItems.length ? (
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-medium text-silver">
                {extractedItems.length} item(ns) identificado(s)
                {extractSource ? ` (${extractSource})` : ""}
              </span>
              <button className="btn btn-primary px-3 py-1 text-[11px]" onClick={addExtractedToCatalog} disabled={busy}>
                Adicionar ao catálogo
              </button>
            </div>
            <div className="max-h-[280px] overflow-auto rounded-lg border border-line/50">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-navy/60 font-mono text-[9px] uppercase tracking-wider text-steel">
                  <tr>
                    <th className="px-3 py-2">Descrição</th>
                    <th className="px-3 py-2">Un.</th>
                    <th className="px-3 py-2 text-right">Qtd.</th>
                    <th className="px-3 py-2 text-right">Unitário</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {extractedItems.map((item, i) => (
                    <tr key={i} className="border-t border-line/40 text-silver">
                      <td className="px-3 py-1.5">{item.description}</td>
                      <td className="px-3 py-1.5">{item.unit}</td>
                      <td className="px-3 py-1.5 text-right">{item.qty}</td>
                      <td className="px-3 py-1.5 text-right">{brl(item.unitPrice)}</td>
                      <td className="px-3 py-1.5 text-right">{brl(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      {/* Novo item manual */}
      <section className="card p-3">
        <div className="label-mono text-signal">Novo item manual</div>
        <p className="mb-2 text-[11px] text-steel">
          Informe o <b className="text-silver">preço do fornecedor</b> e a <b className="text-signal">margem de lucro
          (BDI/markup)</b>. O preço de venda é calculado automaticamente.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
          <select className="field" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="equipamento">Equipamento</option>
            <option value="servico">Serviço</option>
          </select>
          <input className="field" placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="field lg:col-span-2" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex flex-col">
            <span className="label-mono mb-1">Preço fornecedor (R$)</span>
            <input className="field" type="number" step="0.01" value={form.supplierPrice} onChange={(e) => setForm({ ...form, supplierPrice: e.target.value })} />
          </div>
          <div className="flex flex-col">
            <span className="label-mono mb-1">Margem / BDI (%)</span>
            <input className="field" type="number" step="0.01" value={form.margin} onChange={(e) => setForm({ ...form, margin: e.target.value })} />
          </div>
          <div className="flex flex-col items-end">
            <span className="label-mono mb-1">Preço de venda</span>
            <span className="font-display text-sm font-bold text-signal">{brl(formSalePrice / 100)}</span>
          </div>
        </div>
        {error ? <div className="mt-2 text-[11px] text-alarm">{error}</div> : null}
        {flash ? <div className="mt-2 text-[11px] text-armed">{flash}</div> : null}
        <div className="mt-2">
          <button className="btn btn-primary" onClick={create} disabled={busy || !form.description.trim()}>
            {busy ? "Salvando…" : "Adicionar ao catálogo"}
          </button>
        </div>
      </section>

      {/* Tabela do catálogo */}
      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-[12px]">
            <thead>
              <tr className="bg-navy/50 font-mono text-[9px] uppercase tracking-[0.14em] text-steel">
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Especificação</th>
                <th className="px-3 py-2">Un.</th>
                <th className="px-3 py-2 text-right">Fornecedor</th>
                <th className="px-3 py-2 text-right">BDI / markup</th>
                <th className="px-3 py-2 text-right">Venda</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line/40 text-silver">
                  <td className="px-3 py-1.5">
                    <select className="field py-1 text-[11px]" value={row.kind} onChange={(e) => patch(row.id, { kind: e.target.value })}>
                      <option value="equipamento">Equipamento</option>
                      <option value="servico">Serviço</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input className="field min-w-[90px] py-1 text-[11px]" value={row.category} onChange={(e) => patch(row.id, { category: e.target.value })} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input className="field min-w-[180px] py-1 text-[11px]" value={row.description} onChange={(e) => patch(row.id, { description: e.target.value })} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input className="field min-w-[200px] py-1 text-[11px]" value={row.spec ?? ""} onChange={(e) => patch(row.id, { spec: e.target.value })} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input className="field w-[60px] py-1 text-[11px]" value={row.unit} onChange={(e) => patch(row.id, { unit: e.target.value })} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      className="field w-[88px] py-1 text-[11px] text-right"
                      type="number"
                      step="0.01"
                      value={row.supplierPriceCents / 100}
                      onChange={(e) =>
                        patch(row.id, {
                          supplierPriceCents: Math.round(Number(e.target.value) * 100),
                          priceCents: salePriceFromSupplier(Math.round(Number(e.target.value) * 100), row.marginPct),
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      className="field w-[56px] py-1 text-[11px] text-right"
                      type="number"
                      step="0.01"
                      value={row.marginPct}
                      onChange={(e) => {
                        const margin = Math.max(0, Math.min(100, Number(e.target.value || 0)));
                        patch(row.id, { marginPct: margin, priceCents: salePriceFromSupplier(row.supplierPriceCents, margin) });
                      }}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium">
                    {row.supplierPriceCents === 0 ? (
                      <span className="chip !border-amber/50 !text-amber">sem preço</span>
                    ) : (
                      <span className="text-signal">{brl(row.priceCents / 100)}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <div className="flex items-center gap-1">
                      {editingId === row.id ? (
                        <>
                          <button className="mr-1 text-[10.5px] text-signal hover:underline" onClick={() => saveRow(row)} disabled={busy}>
                            {saved === row.id ? "salvo" : "salvar"}
                          </button>
                          <button className="text-[10.5px] text-steel hover:text-silver" onClick={() => setEditingId(null)}>
                            cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="mr-1 text-[10.5px] text-signal hover:underline" onClick={() => startEdit(row)} disabled={busy}>
                            editar
                          </button>
                          <button className="text-[10.5px] text-steel hover:text-alarm" onClick={() => remove(row.id)}>
                            excluir
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[12px] text-steel">
                    Catálogo vazio. Insira um anexo do fornecedor ou adicione um item manualmente.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
