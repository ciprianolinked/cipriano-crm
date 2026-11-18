import "@/components/proposal/doc.css";
import { fmtDate } from "@/lib/brand";
import { LogoMark } from "@/components/ui/Logo";
import { InlineArea, InlineText } from "@/components/ui/Inline";
import type { DeliveryTermItem } from "@/db/schema";

export type DeliveryTermDocSettings = {
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

export type DeliveryTermDocData = {
  termNumber: string;
  proposalNumber: string | null;
  clientName: string;
  site: string | null;
  deliveryDate: string | Date | null;
  technician: string;
  receiverName: string;
  receiverDoc: string;
  items: DeliveryTermItem[];
  intro: string;
  scopeSummary: string;
  tests: string;
  pendencies: string;
  warranty: string;
  observations: string;
  status: string;
};

type TextKey = "intro" | "scopeSummary" | "tests" | "pendencies" | "warranty" | "observations";

function Section({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <section className="cip-sec">
      <div className="cip-sec-head">
        <span className="cip-sec-num">{index}</span>
        <span className="cip-sec-title">{title}</span>
        <span className="cip-sec-line" />
      </div>
      {children}
    </section>
  );
}

/**
 * Termo de entrega. Quando `onChange` é informado, os textos são editados direto no documento;
 * a checklist de itens continua no painel lateral, que acompanha as alterações.
 */
export function DeliveryTermDocument({
  term,
  settings,
  onChange,
}: {
  term: DeliveryTermDocData;
  settings: DeliveryTermDocSettings;
  onChange?: (patch: Partial<DeliveryTermDocData>) => void;
}) {
  const editable = Boolean(onChange);
  const checked = term.items.filter((i) => i.checked).length;
  const text = (key: TextKey) => (onChange ? (v: string) => onChange({ [key]: v } as Partial<DeliveryTermDocData>) : undefined);

  return (
    <article className="cip-doc" id="delivery-term-document">
      <header className="cip-head">
        <div className="cip-brand">
          <LogoMark height={58} />
          <div style={{ borderLeft: "1.5px solid rgba(0,229,255,0.85)", paddingLeft: 14, marginLeft: 2 }}>
            <div className="cip-brand-name">CIPRIANO</div>
            <div className="cip-brand-sub">Tech &amp; Security</div>
            <div className="cip-brand-tag">{settings.tagline}</div>
          </div>
        </div>
        <div className="cip-head-meta">
          <div className="cip-head-kicker">Termo de entrega</div>
          <div className="cip-head-number">{term.termNumber}</div>
          <div className="cip-meta-line">Entrega · {fmtDate(term.deliveryDate)}</div>
          <div className="cip-meta-line">{term.proposalNumber ? `Ref. ${term.proposalNumber}` : "Entrega técnica"}</div>
          <div className="cip-meta-line">{settings.crea}</div>
        </div>
      </header>
      <div className="cip-rule" />

      <section className="cip-strip">
        <div>
          <div className="cip-strip-label">Cliente</div>
          <div className="cip-strip-value">
            <InlineText editable={editable} value={term.clientName} onChange={onChange && ((v) => onChange({ clientName: v }))} />
          </div>
        </div>
        <div>
          <div className="cip-strip-label">Recebedor</div>
          <div className="cip-strip-value">
            <InlineText editable={editable} value={term.receiverName} placeholder="Nome de quem recebe" onChange={onChange && ((v) => onChange({ receiverName: v }))} />
            {editable || term.receiverDoc ? (
              <small>
                <InlineText editable={editable} value={term.receiverDoc} placeholder="CPF / RG" onChange={onChange && ((v) => onChange({ receiverDoc: v }))} />
              </small>
            ) : null}
          </div>
        </div>
        <div>
          <div className="cip-strip-label">Local da entrega</div>
          <div className="cip-strip-value">
            <InlineText editable={editable} value={term.site ?? ""} placeholder="A confirmar" onChange={onChange && ((v) => onChange({ site: v }))} />
          </div>
        </div>
      </section>

      <div className="cip-body">
        <Section index="01" title="Identificação da entrega">
          <InlineArea editable={editable} value={term.intro} placeholder="Identificação da entrega" onChange={text("intro")}>
            <p className="cip-p">{term.intro}</p>
          </InlineArea>
          <div className="cip-terms" style={{ marginTop: 6 }}>
            <div className="cip-term-row">
              <b>Responsável técnico</b>
              <span>
                <InlineText editable={editable} value={term.technician} onChange={onChange && ((v) => onChange({ technician: v }))} />
              </span>
            </div>
            <div className="cip-term-row">
              <b>Data da entrega</b>
              <span>{fmtDate(term.deliveryDate)}</span>
            </div>
            <div className="cip-term-row">
              <b>Proposta de origem</b>
              <span>{term.proposalNumber || "—"}</span>
            </div>
          </div>
        </Section>

        <Section index="02" title="Escopo entregue">
          <InlineArea editable={editable} value={term.scopeSummary} placeholder="Escopo entregue" onChange={text("scopeSummary")}>
            <p className="cip-p">{term.scopeSummary}</p>
          </InlineArea>
          {term.items.length > 0 ? (
            <>
              <div className="cip-group">
                Checklist de entrega · {checked}/{term.items.length} conferidos
              </div>
              <table className="cip-table">
                <thead>
                  <tr>
                    <th style={{ width: "6%" }}>OK</th>
                    <th style={{ width: "44%" }}>Item entregue</th>
                    <th style={{ width: "8%" }}>Un.</th>
                    <th className="num" style={{ width: "8%" }}>
                      Qtd.
                    </th>
                    <th style={{ width: "34%" }}>Série / observação</th>
                  </tr>
                </thead>
                <tbody>
                  {term.items.map((item) => (
                    <tr key={item.id}>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{item.checked ? "☑" : "☐"}</td>
                      <td>
                        <div className="cip-item-title">{item.desc}</div>
                        {item.spec ? <div className="cip-item-spec">{item.spec}</div> : null}
                      </td>
                      <td>{item.unit}</td>
                      <td className="num">{item.qty}</td>
                      <td>{[item.serial, item.obs].filter(Boolean).join(" · ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </Section>

        <Section index="03" title="Testes executados">
          <InlineArea editable={editable} value={term.tests} placeholder="Testes executados, um por linha com •" onChange={text("tests")}>
            <p className="cip-p">{term.tests}</p>
          </InlineArea>
        </Section>

        <Section index="04" title="Pendências">
          <InlineArea editable={editable} value={term.pendencies} placeholder="Pendências, se houver" onChange={text("pendencies")}>
            <p className="cip-p">{term.pendencies}</p>
          </InlineArea>
        </Section>

        <Section index="05" title="Garantia">
          <InlineArea editable={editable} value={term.warranty} placeholder="Garantia" onChange={text("warranty")}>
            <p className="cip-p">{term.warranty}</p>
          </InlineArea>
        </Section>

        <Section index="06" title="Observações e aceite">
          <InlineArea editable={editable} value={term.observations} placeholder="Observações" onChange={text("observations")}>
            <p className="cip-p">{term.observations}</p>
          </InlineArea>
          <div className="cip-sign">
            <div className="cip-sign-line">
              {settings.legalName} · {term.technician || settings.director}
            </div>
            <div className="cip-sign-line">
              {term.clientName} · {term.receiverName || "responsável pelo recebimento"}
            </div>
          </div>
        </Section>

        <div className="cip-seal">
          {["CFTV IP", "Controle de acesso", "Cerca elétrica", "Redes estruturadas", "LGPD"].map((tag) => (
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
