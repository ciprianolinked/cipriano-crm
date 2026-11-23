import "@/components/proposal/doc.css";
import { brl, fmtDate } from "@/lib/brand";
import { LogoMark } from "@/components/ui/Logo";
import { InlineArea, InlineNumber, InlineText } from "@/components/ui/Inline";
import { osKindLabel, osPriority, osStatus, soPartsCents } from "@/lib/service-orders";
import type { ServiceOrderItem } from "@/db/schema";

export type ServiceOrderDocSettings = {
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

export type ServiceOrderDocData = {
  number: string;
  kind: string;
  status: string;
  priority: string;
  clientName: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  site: string | null;
  description: string;
  diagnosis: string;
  solution: string;
  technician: string;
  scheduledAt: string | Date | null;
  startedAt: string | Date | null;
  finishedAt: string | Date | null;
  laborCents: number;
  travelCents: number;
  items: ServiceOrderItem[];
  notes: string;
  clientSignature: string;
  originProposalNumber: string | null;
  budgetProposalNumber: string | null;
};

export type ServiceOrderDocEdit = {
  patch: (patch: Partial<ServiceOrderDocData>) => void;
  item: (id: string, patch: Partial<ServiceOrderItem>) => void;
};

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

export function ServiceOrderDocument({
  os,
  settings,
  edit,
}: {
  os: ServiceOrderDocData;
  settings: ServiceOrderDocSettings;
  edit?: ServiceOrderDocEdit;
}) {
  const editable = Boolean(edit);
  const parts = soPartsCents(os);
  const status = osStatus(os.status);
  const priority = osPriority(os.priority);

  return (
    <article className="cip-doc" id="service-order-document">
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
          <div className="cip-head-kicker">Ordem de serviço</div>
          <div className="cip-head-number">{os.number}</div>
          <div className="cip-meta-line">
            {status.label} · {priority.label}
          </div>
          <div className="cip-meta-line">
            {os.originProposalNumber ? `Proposta ${os.originProposalNumber}` : osKindLabel(os.kind)}
          </div>
          <div className="cip-meta-line">{settings.crea}</div>
        </div>
      </header>
      <div className="cip-rule" />

      <section className="cip-strip">
        <div>
          <div className="cip-strip-label">Cliente</div>
          <div className="cip-strip-value">
            <InlineText editable={editable} value={os.clientName} onChange={edit && ((v) => edit.patch({ clientName: v }))} />
            {editable || os.phone ? (
              <small>
                <InlineText editable={editable} value={os.phone ?? ""} placeholder="telefone" onChange={edit && ((v) => edit.patch({ phone: v }))} />
              </small>
            ) : null}
          </div>
        </div>
        <div>
          <div className="cip-strip-label">Técnico responsável</div>
          <div className="cip-strip-value">
            <InlineText editable={editable} value={os.technician} placeholder="Quem executa" onChange={edit && ((v) => edit.patch({ technician: v }))} />
          </div>
        </div>
        <div>
          <div className="cip-strip-label">Local do atendimento</div>
          <div className="cip-strip-value">
            <InlineText editable={editable} value={os.site ?? ""} placeholder="A confirmar" onChange={edit && ((v) => edit.patch({ site: v }))} />
          </div>
        </div>
      </section>

      <div className="cip-body">
        <Section index="01" title="Solicitação">
          <InlineArea editable={editable} value={os.description} placeholder="Descreva a solicitação ou o defeito" onChange={edit && ((v) => edit.patch({ description: v }))}>
            <p className="cip-p">{os.description}</p>
          </InlineArea>
          <div className="cip-terms" style={{ marginTop: 6 }}>
            <div className="cip-term-row">
              <b>Tipo</b>
              <span>{osKindLabel(os.kind)}</span>
            </div>
            <div className="cip-term-row">
              <b>Agendada</b>
              <span>{os.scheduledAt ? fmtDate(os.scheduledAt) : "a agendar"}</span>
            </div>
            <div className="cip-term-row">
              <b>Início / conclusão</b>
              <span>
                {os.startedAt ? fmtDate(os.startedAt) : "—"} · {os.finishedAt ? fmtDate(os.finishedAt) : "em aberto"}
              </span>
            </div>
            <div className="cip-term-row">
              <b>Proposta de origem</b>
              <span>{os.originProposalNumber || "—"}</span>
            </div>
          </div>
        </Section>

        <Section index="02" title="Diagnóstico e solução">
          <div className="cip-group">Diagnóstico técnico</div>
          <InlineArea editable={editable} value={os.diagnosis} placeholder="O que foi identificado em campo" onChange={edit && ((v) => edit.patch({ diagnosis: v }))}>
            <p className="cip-p">{os.diagnosis || "A preencher pelo técnico."}</p>
          </InlineArea>
          <div className="cip-group">Solução executada / proposta</div>
          <InlineArea editable={editable} value={os.solution} placeholder="Serviço e peças necessárias" onChange={edit && ((v) => edit.patch({ solution: v }))}>
            <p className="cip-p">{os.solution || "A preencher pelo técnico."}</p>
          </InlineArea>
        </Section>

        <Section index="03" title="Peças, materiais e serviços">
          {os.items.length ? (
            <table className="cip-table">
              <thead>
                <tr>
                  <th style={{ width: "6%" }}>OK</th>
                  <th style={{ width: "48%" }}>Descrição</th>
                  <th style={{ width: "8%" }}>Un.</th>
                  <th className="num" style={{ width: "8%" }}>Qtd.</th>
                  <th className="num" style={{ width: "15%" }}>Unitário</th>
                  <th className="num" style={{ width: "15%" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {os.items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{item.checked ? "☑" : "☐"}</td>
                    <td>
                      <InlineText editable={editable} className="cip-item-title" value={item.desc} onChange={edit && ((v) => edit.item(item.id, { desc: v }))} />
                      <InlineText editable={editable} className="cip-item-spec" value={item.spec} placeholder="especificação" onChange={edit && ((v) => edit.item(item.id, { spec: v }))} />
                      {item.billable === false ? <div className="cip-item-spec">conferência · não cobrado</div> : null}
                    </td>
                    <td>{item.unit}</td>
                    <td className="num">{item.qty}</td>
                    <td className="num">{brl(item.priceCents / 100)}</td>
                    <td className="num">{item.billable === false ? "—" : brl((item.priceCents * item.qty) / 100)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td colSpan={5}>Peças e materiais</td>
                  <td className="num">{brl(parts.partsCents / 100)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="cip-p">Sem peças registradas. Serviço de mão de obra ou diagnóstico.</p>
          )}

          <div className="cip-terms" style={{ marginTop: 10 }}>
            <div className="cip-term-row">
              <b>Mão de obra</b>
              <span className="cip-inline-row">
                <span>R$</span>
                <InlineNumber
                  editable={editable}
                  value={parts.laborCents / 100}
                  min={0}
                  step={10}
                  align="right"
                  onChange={edit && ((v) => edit.patch({ laborCents: Math.round(v * 100) }))}
                />
              </span>
            </div>
            <div className="cip-term-row">
              <b>Deslocamento</b>
              <span className="cip-inline-row">
                <span>R$</span>
                <InlineNumber
                  editable={editable}
                  value={parts.travelCents / 100}
                  min={0}
                  step={10}
                  align="right"
                  onChange={edit && ((v) => edit.patch({ travelCents: Math.round(v * 100) }))}
                />
              </span>
            </div>
            <div className="cip-term-row">
              <b>Total da OS</b>
              <span style={{ fontWeight: 700 }}>{brl(parts.totalCents / 100)}</span>
            </div>
            {os.budgetProposalNumber ? (
              <div className="cip-term-row">
                <b>Orçamento vinculado</b>
                <span>{os.budgetProposalNumber}</span>
              </div>
            ) : null}
          </div>
        </Section>

        <Section index="04" title="Observações">
          <InlineArea editable={editable} value={os.notes} placeholder="Acesso, janela de atendimento, riscos, combinados…" onChange={edit && ((v) => edit.patch({ notes: v }))}>
            <p className="cip-p">{os.notes || "Sem observações."}</p>
          </InlineArea>
        </Section>

        <Section index="05" title="Encerramento">
          <p className="cip-p">
            Declaro que o serviço descrito nesta ordem foi executado e conferido, com os itens acima testados na presença
            do responsável do cliente. Peças e serviços não previstos dependem de orçamento complementar aprovado.
          </p>
          <InlineArea editable={editable} value={os.clientSignature} placeholder="Nome de quem recebeu o serviço" onChange={edit && ((v) => edit.patch({ clientSignature: v }))}>
            <p className="cip-p">{os.clientSignature || ""}</p>
          </InlineArea>
          <div className="cip-sign">
            <div className="cip-sign-line">
              {settings.legalName} · {os.technician || settings.director}
            </div>
            <div className="cip-sign-line">{os.clientName} · {os.clientSignature || "responsável pelo recebimento"}</div>
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
