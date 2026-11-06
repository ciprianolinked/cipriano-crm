"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

export function CatalogManager({ items }: { items: CatalogRecord[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [form, setForm] = useState({
    kind: "equipamento",
    category: "CFTV",
    description: "",
    spec: "",
    unit: "un",
    supplierPrice: "",
    margin: "30",
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const formSalePrice = salePriceFromSupplier(
    Number(form.supplierPrice || 0) * 100,
    Number(form.margin || 30),
  );

  async function saveRow(row: CatalogRecord) {
    setBusy(true);
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
    setBusy(false);
    if (res.ok) {
      setSaved(row.id);
      setTimeout(() => setSaved(null), 1500);
      router.refresh();
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
    const supplier = Math.round((Number(form.supplierPrice || 0) * 100));
    const margin = Math.max(0, Math.min(100, Number(form.margin || 30)));
    setBusy(true);
    const res = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: form.kind,
        category: form.category,
        description: form.description,
        spec: form.spec,
        unit: form.unit,
        supplierPrice: supplier / 100,
        margin,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setForm({
        kind: form.kind,
        category: form.category,
        description: "",
        spec: "",
        unit: "un",
        supplierPrice: "",
        margin: "30",
      });
      router.refresh();
    }
  }

  async function remove(id: string) {
    await fetch(`/api/catalog?id=${id}`, { method: "DELETE" });
    setRows((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <section className="card p-3">
        <div className="label-mono text-signal">Novo item de catálogo</div>
        <p className="mb-2 text-[11px] text-steel">
          Informe o <b className="text-silver">preço do fornecedor</b> e a <b className="text-signal">margem de lucro
          (BDI/markup)</b>. O preço de venda é calculado automaticamente e usado nas propostas.
        </p>
        {items.filter((i) => i.supplierPriceCents === 0).length > 0 ? (
          <div className="mb-2 rounded-lg border border-amber/45 bg-amber/6 px-3 py-2 text-[11px] text-silver">
            <b className="text-amber">
              {items.filter((i) => i.supplierPriceCents === 0).length} item(ns) sem preço de fornecedor.
            </b>{" "}
            Lance o valor que você paga e a margem para cada um — os preços são editáveis direto na tabela abaixo. Itens
            sem preço saem zerados nas propostas.
          </div>
        ) : null}
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
          <select className="field" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="equipamento">Equipamento</option>
            <option value="servico">Serviço</option>
          </select>
          <input className="field" placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="field lg:col-span-2" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex flex-col">
            <span className="label-mono mb-1">Preço do fornecedor (R$)</span>
            <input
              className="field"
              type="number"
              step="0.01"
              value={form.supplierPrice}
              onChange={(e) => setForm({ ...form, supplierPrice: e.target.value })}
            />
          </div>
          <div className="flex flex-col">
            <span className="label-mono mb-1">Margem / BDI (%)</span>
            <input
              className="field"
              type="number"
              step="0.01"
              value={form.margin}
              onChange={(e) => setForm({ ...form, margin: e.target.value })}
            />
          </div>
          <div className="flex flex-col items-end">
            <span className="label-mono mb-1">Preço de venda</span>
            <span className="font-display text-sm font-bold text-signal">{brl(formSalePrice / 100)}</span>
          </div>
          <button className="btn btn-primary lg:col-span-2" onClick={create} disabled={busy}>
            {busy ? "Salvando…" : "Adicionar ao catálogo"}
          </button>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[12px]">
            <thead>
              <tr className="bg-navy/50 font-mono text-[9px] uppercase tracking-[0.14em] text-steel">
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Especificação</th>
                <th className="px-3 py-2">Un.</th>
                <th className="px-3 py-2 text-right">Preço fornecedor</th>
                <th className="px-3 py-2 text-right">BDI / markup</th>
                <th className="px-3 py-2 text-right">Preço de venda</th>
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
                    <input className="field min-w-[220px] py-1 text-[11px]" value={row.spec ?? ""} onChange={(e) => patch(row.id, { spec: e.target.value })} />
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
                        patch(row.id, { supplierPriceCents: Math.round(Number(e.target.value) * 100) })
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
                        const price = salePriceFromSupplier(row.supplierPriceCents, margin);
                        patch(row.id, { marginPct: margin, priceCents: price });
                      }}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium">
                    {row.supplierPriceCents === 0 ? (
                      <span className="chip !border-amber/50 !text-amber" title="Informe o preço do seu fornecedor">
                        sem preço
                      </span>
                    ) : (
                      <span className="text-signal">{brl(row.priceCents / 100)}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <div className="flex items-center gap-1">
                      {editingId === row.id ? (
                        <div className="flex gap-1">
                          <button
                            className="mr-1 text-[10.5px] text-signal hover:underline"
                            onClick={() => saveRow(row)}
                            disabled={busy}
                          >
                            {saved === row.id ? "salvo" : "salvar"}
                          </button>
                          <button
                            className="text-[10.5px] text-steel hover:text-silver"
                            onClick={() => setEditingId(null)}
                          >
                            cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            className="mr-1 text-[10.5px] text-signal hover:underline"
                            onClick={() => startEdit(row)}
                            disabled={busy}
                          >
                            editar
                          </button>
                          <button className="text-[10.5px] text-steel hover:text-alarm" onClick={() => remove(row.id)}>
                            excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
