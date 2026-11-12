import "./doc.css";
import { brl, fmtDate } from "@/lib/brand";
import { LogoMark } from "@/components/ui/Logo";
import { calcTotals } from "@/lib/proposal/catalog";
import type { ProposalItem, ProposalSection, ProposalType } from "@/lib/proposal/types";
import { typeLabels } from "@/lib/proposal/catalog";
import { isMaintenanceProposal, maintenanceSummary } from "@/lib/proposal/maintenance-plan";

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
  briefing?: Record<string, unknown> | null;
};

function BrandMark({ size = 38 }: { size?: number }) {
  return <LogoMark height={size} />;
}

function Body({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return <div className="cip-space" key={i} />;
        if (/^[•\-–]\s+/.test(line)) {
          return (
            <div className="cip-b" key={i}>
              <span className="cip-b-marker">▸</span>
              <span>{line.replace(/^[•\-–]\s+/, "")}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          return (
            <div className="cip-b" key={i}>
              <span className="cip-b-marker">{line.split(".")[0]}.</span>
              <span>{line.replace(/^\d+\.\s/, "")}</span>
            </div>
          );
        }
        return (
          <p className="cip-p" key={i}>
            {line}
          </p>
        );
      })}
    </>
  );
}

function ItemsTable({ items }: { items: ProposalItem[] }) {
  // Quando o item traz escopo (proposta igualada ao concorrente), agrupa por disciplina.
  const hasScope = items.some((item) => Boolean(item.scope));
  const groups: { key: string; label: string; rows: ProposalItem[] }[] = [];
  if (hasScope) {
    for (const item of items) {
      const label = item.scope?.trim() || "Itens Complementares";
      const key = `scope-${label}`;
      const existing = groups.find((group) => group.key === key);
      if (existing) existing.rows.push(item);
      else groups.push({ key, label, rows: [item] });
    }
  } else {
    groups.push(
      { key: "equipamento", label: "Equipamentos", rows: items.filter((item) => item.kind === "equipamento") },
      { key: "servico", label: "Serviços", rows: items.filter((item) => item.kind === "servico") },
    );
  }
  return (
    <>
      {groups.map((group) => {
        const rows = group.rows;
        if (rows.length === 0) return null;
        const total = rows.reduce((acc, item) => acc + item.qty * item.price, 0);
        return (
          <div key={group.key} style={{ marginTop: 6 }}>
            <div className="cip-group">{group.label}</div>
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
                  <tr key={item.id}>
                    <td>
                      <div className="cip-item-title">{item.desc}</div>
                      {item.spec ? <div className="cip-item-spec">{item.spec}</div> : null}
                    </td>
                    <td>{item.unit}</td>
                    <td className="num">{item.qty}</td>
                    <td className="num">{brl(item.price)}</td>
                    <td className="num">{brl(item.price * item.qty)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td colSpan={4}>Subtotal · {group.label}</td>
                  <td className="num">{brl(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}


function ConditionsBlock({
  section,
  proposal,
  maintenance,
}: {
  section: ProposalSection;
  proposal: DocData;
  maintenance: boolean;
}) {
  const intro: string[] = [];
  const rows: [string, string][] = [];
  for (const raw of section.body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const isBullet = /^[•\-–]\s*/.test(line);
    const clean = line.replace(/^[•\-–]\s*/, "").trim();
    const separator = clean.indexOf(":");
    if (isBullet && separator > 0) {
      rows.push([clean.slice(0, separator).trim(), clean.slice(separator + 1).trim()]);
    } else if (isBullet) {
      rows.push(["Condição", clean]);
    } else {
      intro.push(clean);
    }
  }
  if (!rows.length) {
    const payment = intro.length ? intro.join(" ") : proposal.paymentTerms || "A combinar";
    intro.length = 0;
    rows.push(
      ["Pagamento", payment],
      [maintenance ? "Serviços recorrentes" : "Execução", proposal.deliveryTime || "A combinar"],
      ["Garantia", proposal.warranty || "A combinar"],
      ["Validade", `${proposal.validityDays} dias corridos a partir da emissão`],
    );
  }
  return (
    <>
      {intro.map((line, i) => (
        <p className="cip-p" key={i}>
          {line}
        </p>
      ))}
      <div className="cip-terms" style={{ marginTop: 6 }}>
        {rows.map(([label, value], i) => (
          <div className="cip-term-row" key={i}>
            <b>{label}</b>
            <span>{value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function ProposalDocument({ proposal, settings }: { proposal: DocData; settings: DocSettings }) {
  const totals = calcTotals(proposal.items, proposal.discountPct);
  const maintenance = isMaintenanceProposal(proposal.briefing);
  const monthly = maintenanceSummary(proposal.items, proposal.discountPct, proposal.briefing);
  const enabled = proposal.sections.filter((s) => s.enabled);
  const totalLabel = maintenance ? "Proposta de manutenção mensal" : typeLabels[(proposal.type as ProposalType) ?? "completa"] ?? "Proposta comercial";

  return (
    <article className="cip-doc" id="proposal-document">
      <header className="cip-head">
        <div className="cip-brand">
          <BrandMark size={58} />
          <div
            style={{
              borderLeft: "1.5px solid rgba(0,229,255,0.85)",
              paddingLeft: 14,
              marginLeft: 2,
            }}
          >
            <div className="cip-brand-name">CIPRIANO</div>
            <div className="cip-brand-sub">Tech &amp; Security</div>
            <div className="cip-brand-tag">{settings.tagline}</div>
          </div>
        </div>
        <div className="cip-head-meta">
          <div className="cip-head-kicker">{totalLabel}</div>
          <div className="cip-head-number">{proposal.number}</div>
          <div className="cip-meta-line">Emissão · {fmtDate(proposal.issuedAt)}</div>
          <div className="cip-meta-line">Validade · {proposal.validityDays} dias</div>
          <div className="cip-meta-line">{settings.crea}</div>
        </div>
      </header>
      <div className="cip-rule" />

      <section className="cip-strip">
        <div>
          <div className="cip-strip-label">Cliente</div>
          <div className="cip-strip-value">
            {proposal.clientName}
            {proposal.clientEmail ? <small>{proposal.clientEmail}</small> : null}
          </div>
        </div>
        <div>
          <div className="cip-strip-label">Contato</div>
          <div className="cip-strip-value">{proposal.contact || "—"}</div>
        </div>
        <div>
          <div className="cip-strip-label">{maintenance ? "Local de atendimento" : "Local de instalação"}</div>
          <div className="cip-strip-value">{proposal.site || "A confirmar"}</div>
        </div>
      </section>

      <div className="cip-body">
        {enabled.map((section, index) => (
          <section className="cip-sec" key={section.id}>
            <div className="cip-sec-head">
              <span className="cip-sec-num">{String(index + 1).padStart(2, "0")}</span>
              <span className="cip-sec-title">{section.title}</span>
              <span className="cip-sec-line" />
            </div>

            {section.kind === "table" && section.rows ? (
              <>
                <Body text={section.body} />
                <table className="cip-table" style={{ marginTop: 4 }}>
                  <thead>
                    <tr>
                      <th style={{ width: "38%" }}>{section.columns?.[0] ?? "Frente de trabalho"}</th>
                      <th style={{ width: "40%" }}>{section.columns?.[1] ?? "Cipriano Tech & Security"}</th>
                      <th>{section.columns?.[2] ?? "Cliente"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, i) => (
                      <tr key={i}>
                        <td>{row.label}</td>
                        <td>{row.cipriano}</td>
                        <td>{row.client}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : section.kind === "terms" ? (
              <ConditionsBlock section={section} proposal={proposal} maintenance={maintenance} />
            ) : (
              <Body text={section.body} />
            )}

            {section.kind === "items" ? <ItemsTable items={proposal.items} /> : null}

            {section.kind === "totals" ? (
              <>
                <div className="cip-totals">
                  <div>
                    <div className="cip-t-label">{maintenance ? "Mensalidade da manutenção" : "Investimento total"}</div>
                    <div className="cip-t-big">{brl((maintenance ? monthly.monthlyCents : totals.totalCents) / 100)}{maintenance ? " / mês" : ""}</div>
                    <div className="cip-t-sub">
                      {maintenance ? `${monthly.months} meses de vigência · ${proposal.discountPct}% de desconto` : `${proposal.items.length} itens · desconto comercial de ${proposal.discountPct}% aplicado`}
                    </div>
                  </div>
                  <div>
                    <div className="cip-t-label">Resumo</div>
                    <div className="cip-mini">
                      <span>Subtotal</span>
                      <span>{brl(totals.subtotalCents / 100)}</span>
                    </div>
                    <div className="cip-mini">
                      <span>Desconto</span>
                      <span>− {brl(totals.offCents / 100)}</span>
                    </div>
                    <div className="cip-mini">
                      <span>{maintenance ? "Total do período" : "12× de"}</span>
                      <span>{brl((maintenance ? totals.totalCents : totals.installmentCents) / 100)}</span>
                    </div>
                  </div>
                </div>
                <div className="cip-mini-grid">
                  <div className="cip-mini">
                    <span>Pagamento</span>
                    <span>{proposal.paymentTerms || "A combinar"}</span>
                  </div>
                  <div className="cip-mini">
                    <span>Prazo</span>
                    <span>{proposal.deliveryTime || "A combinar"}</span>
                  </div>
                  <div className="cip-mini">
                    <span>Garantia</span>
                    <span>{proposal.warranty || "A combinar"}</span>
                  </div>
                  <div className="cip-mini">
                    <span>Validade</span>
                    <span>{proposal.validityDays} dias</span>
                  </div>
                </div>
              </>
            ) : null}

            {section.id === "aceite" ? (
              <div className="cip-sign">
                <div className="cip-sign-line">
                  {(proposal.briefing?.ciprianoSignatory as string) || `${settings.legalName} · ${settings.director}`}
                </div>
                <div className="cip-sign-line">
                  {(proposal.briefing?.clientSignatory as string) || `${proposal.clientName} · responsável pelo aceite`}
                </div>
              </div>
            ) : null}
          </section>
        ))}

        <div className="cip-seal">
          {((proposal.briefing?.sealTags as string[]) || ["CFTV IP", "Controle de acesso", "Cerca elétrica", "Monitoramento 24h", "LGPD"]).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>

      <footer className="cip-foot">
        <div>
          <strong>{settings.companyName}</strong> · {settings.legalName}
          <br />
          {settings.address} · CNPJ {settings.cnpj}
        </div>
        <div style={{ textAlign: "right" }}>
          {settings.phone} · {settings.email}
          <br />
          {settings.site} · {settings.hours}
        </div>
      </footer>
    </article>
  );
}
