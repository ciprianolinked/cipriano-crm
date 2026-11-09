import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { HelpCenter } from "@/components/HelpCenter";

export const metadata: Metadata = {
  title: "Como usar o mapa de cotação · Ajuda Gerencial",
  description: "Aprenda a criar mapas, analisar propostas, comparar fornecedores e salvar o documento em PDF.",
};

export default function AjudaPage() {
  return (
    <AppShell>
      <HelpCenter />
    </AppShell>
  );
}
