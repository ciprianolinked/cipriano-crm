import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function NewMaintenanceContractPage({ searchParams }: { searchParams: Promise<{ proposta?: string }> }) {
  const params = await searchParams;
  redirect(`/contratos/novo?modalidade=manutencao${params.proposta ? `&proposta=${encodeURIComponent(params.proposta)}` : ""}`);
}
