import { redirect } from "next/navigation";

/** Compatibilidade com links antigos: o dashboard oficial agora é /indicadores. */
export default function LegacyDashboardPage() {
  redirect("/indicadores");
}
