import { ensureBootstrap, listCatalog } from "@/lib/data";
import { CatalogManager } from "@/components/catalog/CatalogManager";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  await ensureBootstrap();
  const items = await listCatalog();
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 lg:px-7 lg:py-7">
      <header className="border-b border-line/50 pb-4">
        <div className="label-mono text-signal">Biblioteca técnica</div>
        <h1 className="mt-2 font-display text-[clamp(1.5rem,2.6vw,2rem)] font-semibold text-white">
          Catálogo de equipamentos e serviços
        </h1>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-steel">
          Preço do fornecedor + margem (BDI/markup) calculam o preço de venda. Insira um anexo do
          fornecedor para a IA extrair os itens automaticamente.
        </p>
      </header>
      <div className="mt-4">
        <CatalogManager
          items={items.map((i) => ({
            id: i.id,
            kind: i.kind,
            category: i.category,
            description: i.description,
            spec: i.spec,
            unit: i.unit,
            supplierPriceCents: i.supplierPriceCents,
            marginPct: i.marginPct,
            priceCents: i.priceCents,
            active: i.active,
          }))}
        />
      </div>
    </div>
  );
}
