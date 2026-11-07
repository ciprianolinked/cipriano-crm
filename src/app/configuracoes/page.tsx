import { ensureBootstrap, getSettings } from "@/lib/data";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { ResetDataButton } from "@/components/settings/ResetDataButton";
import { loadDatabasePage } from "@/components/system/load-database-page";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const loaded = await loadDatabasePage(async () => {
    await ensureBootstrap();
    return getSettings();
  });
  if (!loaded.ok) return loaded.recovery;
  const settings = loaded.data;
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 lg:px-7 lg:py-7">
      <header className="border-b border-line/50 pb-4">
        <div className="label-mono text-signal">Identidade visual</div>
        <h1 className="mt-2 font-display text-[clamp(1.5rem,2.6vw,2rem)] font-semibold text-white">
          Timbrado e padrões comerciais
        </h1>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-steel">
          Os dados abaixo alimentam o cabeçalho e o rodapé de todas as propostas, além das condições comerciais padrão.
          A paleta e a tipografia seguem o sistema de identidade Cipriano.
        </p>
      </header>
      <div className="mt-4">
        <SettingsForm
          initial={{
            id: settings.id,
            companyName: settings.companyName,
            legalName: settings.legalName,
            tagline: settings.tagline,
            director: settings.director,
            role: settings.role,
            phone: settings.phone,
            landline: settings.landline,
            email: settings.email,
            site: settings.site,
            address: settings.address,
            cnpj: settings.cnpj,
            crea: settings.crea,
            hours: settings.hours,
            defaultValidityDays: settings.defaultValidityDays,
            defaultPaymentTerms: settings.defaultPaymentTerms,
            defaultDeliveryTime: settings.defaultDeliveryTime,
            defaultWarranty: settings.defaultWarranty,
          }}
        />

        <div className="mt-4">
          <ResetDataButton />
        </div>
      </div>
    </div>
  );
}
