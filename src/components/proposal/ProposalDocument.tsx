import "./doc.css";
import { brl, fmtDate } from "@/lib/brand";
import { calcTotals, typeLabels } from "@/lib/proposal/catalog";
import type { ProposalItem, ProposalSection, ProposalType } from "@/lib/proposal/types";
import { isMaintenanceProposal, maintenanceSummary } from "@/lib/proposal/maintenance-plan";
import { A4Document } from "@/components/documents/A4Document";
import { CiprianoDocumentHeader, type DocumentFooterData } from "@/components/documents/DocumentChrome";

export type DocSettings = {
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
};

export type DocData = {
  number: string;
  type: ProposalType | string;
  clientName: string;
  contact: string | null;
  clientEmail: string | null;
  site: string | null;
  issuedAt: string | Date;
  validityDays: number;
  discountPct: number;
  items: ProposalItem[];
  sections: ProposalSection[];
  paymentTerms: string | null;
  deliveryTime: string | null;
  warranty: string | null;
  artIncluded: boolean;
  revision?: number;
  briefing?: Record<string, unknown> | null;
};

function Body({ text, sectionId }: { text: string; sectionId: string }) {
  return (
    <>
      {text.split("\n").map((raw, i) => {
        const line = raw.trim();
        const key = `${sectionId}-line-${i}`;
        if (!line) return <div key={key} data-pdf-block className="cip-space" />;
        if (/^[•\-–]\s+/.test(line)) {
          return (
            <div key={key} data-pdf-block data-pdf-split="text" data-pdf-text-selector=".cip-b-text" data-pdf-source="proposal" data-pdf-key={key}>
              <div className="cip-b"><span className="cip-b-marker">▸</span><span className="cip-b-text" data-pdf-text>{line.replace(/^[•\-–]\s+/, "")}</span></div>
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          return (
            <div key={key} data-pdf-block data-pdf-split="text" data-pdf-text-selector=".cip-b-text" data-pdf-source="proposal" data-pdf-key={key}>
              <div className="cip-b"><span className="cip-b-marker">{line.split(".")[0]}.</span><span className="cip-b-text" data-pdf-text>{line.replace(/^\d+\.\s/, "")}</span></div>
            </div>
          );
        }
        return (
          <div key={key} data-pdf-block data-pdf-split="text" data-pdf-source="proposal" data-pdf-key={key}>
            <p className="cip-p" data-pdf-text>{line}</p>
          </div>
        );
      })}
    </>
  );
}

function ItemsTable({ items }: { items: ProposalItem[] }) {
  const groups: { key: ProposalItem["kind"]; label: string }[] = [
    { key: "equipamento", label: "Equipamentos" },
    { key: "servico", label: "Serviços" },
  ];
  return (
    <>
      {groups.map((group) => {
        const rows = items.filter((i) => i.kind === group.key);
        if (!rows.length) return null;
        const total = rows.reduce((a, i) => a + i.qty * i.price, 0);
        return (
          <div key={group.key}>
            <div data-pdf-block data-pdf-keep-next className="cip-group">{group.label}</div>
            <div data-pdf-block data-pdf-kind="table" data-pdf-caption={group.label}>
              <table className="cip-table">
                <thead>
                  <tr>
                    <th style={{ width: "46%" }}>Descrição / especificação</th>
                    <th style={{ width: "9%" }}>Un.</th>
                    <th className="num" style={{ width: "8%" }}>Qtd.</th>
                    <th className="num" style={{ width: "17%" }}>Unitário</th>
                    <th className="num" style={{ width: "20%" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.id} data-pdf-row-key={item.id}>
                      <td><div className="cip-item-title">{item.desc}</div>{item.spec ? <div className="cip-item-spec">{item.spec}</div> : null}</td>
                      <td>{item.unit}</td>
                      <td className="num">{item.qty}</td>
                      <td className="num">{brl(item.price)}</td>
                      <td className="num">{brl(item.price * item.qty)}</td>
                    </tr>
                  ))}
                  <tr className="total" data-pdf-keep-with-previous>
                    <td colSpan={4}>Subtotal {group.label.toLowerCase()}</td>
                    <td className="num">{brl(total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}

function TermRow({ label, value }: { label: string; value: string }) {
  return (
    <div data-pdf-block data-pdf-split="text" data-pdf-text-selector=".cip-term-value" className="cip-terms cip-term-single">
      <div className="cip-term-row"><b>{label}</b><span className="cip-term-value" data-pdf-text>{value}</span></div>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div data-pdf-block data-pdf-split="text" data-pdf-text-selector=".cip-mini-value" className="cip-mini cip-mini-row">
      <span>{label}</span><span className="cip-mini-value" data-pdf-text>{value}</span>
    </div>
  );
}

export function ProposalDocument({ proposal, settings }: { proposal: DocData; settings: DocSettings }) {
  const totals = calcTotals(proposal.items, proposal.discountPct);
  const maintenance = isMaintenanceProposal(proposal.briefing);
  const monthly = maintenanceSummary(proposal.items, proposal.discountPct, proposal.briefing);
  const enabled = proposal.sections.filter((s) => s.enabled);
  const title = maintenance ? "Proposta de manutenção mensal" : typeLabels[(proposal.type as ProposalType) ?? "completa"] ?? "Proposta comercial";
  const revision = `Rev. ${String(proposal.revision ?? 1).padStart(2, "0")}`;
  const footer: DocumentFooterData = {
    companyName: settings.companyName,
    legalName: settings.legalName,
    address: settings.address,
    cnpj: settings.cnpj,
    crea: settings.crea,
    phone: settings.phone,
    email: settings.email,
    site: settings.site,
    documentLabel: maintenance ? "Proposta de manutenção" : "Proposta comercial",
    documentNumber: proposal.number,
    revision,
    notice: "Documento comercial · Confira escopo, valores, prazo e validade antes do aceite.",
  };

  return (
    <A4Document
      id="proposal-document"
      className="cip-doc"
      header={<CiprianoDocumentHeader title={title} number={proposal.number} tagline={settings.tagline} meta={[`Emissão · ${fmtDate(proposal.issuedAt)}`, `Validade · ${proposal.validityDays} dias`, settings.crea]} />}
      footer={footer}
    >
      <div data-pdf-block data-pdf-atomic className="cip-strip">
        <div><div className="cip-strip-label">Cliente</div><div className="cip-strip-value">{proposal.clientName}{proposal.clientEmail ? <small>{proposal.clientEmail}</small> : null}</div></div>
        <div><div className="cip-strip-label">Contato</div><div className="cip-strip-value">{proposal.contact || "—"}</div></div>
        <div><div className="cip-strip-label">{maintenance ? "Local de atendimento" : "Local de instalação"}</div><div className="cip-strip-value">{proposal.site || "A confirmar"}</div></div>
      </div>

      {enabled.map((section, index) => (
        <div key={section.id}>
          <div data-pdf-block data-pdf-keep-next className="cip-sec-head">
            <span className="cip-sec-num">{String(index + 1).padStart(2, "0")}</span>
            <span className="cip-sec-title">{section.title}</span>
            <span className="cip-sec-line" />
          </div>
          <Body text={section.body} sectionId={section.id} />

          {section.kind === "table" && section.rows ? (
            <div data-pdf-block data-pdf-kind="table" data-pdf-caption={section.title}>
              <table className="cip-table">
                <thead><tr><th style={{ width: "44%" }}>Frente de trabalho</th><th style={{ width: "28%" }}>Cipriano Tech &amp; Security</th><th>Cliente</th></tr></thead>
                <tbody>{section.rows.map((row, i) => <tr key={i} data-pdf-row-key={`${section.id}-${i}`}><td>{row.label}</td><td>{row.cipriano}</td><td>{row.client}</td></tr>)}</tbody>
              </table>
            </div>
          ) : null}

          {section.kind === "items" ? <ItemsTable items={proposal.items} /> : null}

          {section.kind === "terms" ? (
            <>
              <TermRow label="Pagamento" value={proposal.paymentTerms || "A combinar"} />
              <TermRow label="Execução" value={proposal.deliveryTime || "A combinar"} />
              <TermRow label="Garantia" value={proposal.warranty || "A combinar"} />
              <TermRow label="Validade" value={`${proposal.validityDays} dias corridos a partir da emissão`} />
            </>
          ) : null}

          {section.kind === "totals" ? (
            <>
              <div data-pdf-block data-pdf-atomic className="cip-totals">
                <div>
                  <div className="cip-t-label">{maintenance ? "Mensalidade da manutenção" : "Investimento total"}</div>
                  <div className="cip-t-big">{brl((maintenance ? monthly.monthlyCents : totals.totalCents) / 100)}{maintenance ? " / mês" : ""}</div>
                  <div className="cip-t-sub">{maintenance ? `${monthly.months} meses de vigência · ${proposal.discountPct}% de desconto` : `${proposal.items.length} itens · desconto comercial de ${proposal.discountPct}% aplicado`}</div>
                </div>
                <div>
                  <div className="cip-t-label">Resumo</div>
                  <div className="cip-mini"><span>Subtotal</span><span>{brl(totals.subtotalCents / 100)}</span></div>
                  <div className="cip-mini"><span>Desconto</span><span>− {brl(totals.offCents / 100)}</span></div>
                  <div className="cip-mini"><span>{maintenance ? "Total do período" : "12× de"}</span><span>{brl((maintenance ? totals.totalCents : totals.installmentCents) / 100)}</span></div>
                </div>
              </div>
              <MiniRow label="Pagamento" value={proposal.paymentTerms || "A combinar"} />
              <MiniRow label="Prazo" value={proposal.deliveryTime || "A combinar"} />
              <MiniRow label="Garantia" value={proposal.warranty || "A combinar"} />
              <MiniRow label="Validade" value={`${proposal.validityDays} dias`} />
            </>
          ) : null}

          {section.id === "aceite" ? (
            <div data-pdf-block data-pdf-atomic className="cip-sign">
              <div className="cip-sign-line">{settings.legalName} · {settings.director}</div>
              <div className="cip-sign-line">{proposal.clientName} · responsável pelo aceite</div>
            </div>
          ) : null}
        </div>
      ))}

      <div data-pdf-block data-pdf-atomic className="cip-seal">
        {["CFTV IP", "Controle de acesso", "Cerca elétrica", "Monitoramento 24h", "LGPD"].map((tag) => <span key={tag}>{tag}</span>)}
      </div>
    </A4Document>
  );
}
