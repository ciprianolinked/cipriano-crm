"use client";

import "./doc.css";
import type { ProposalItem } from "@/lib/proposal/types";
import type { DeliveryTermSection } from "@/lib/proposal/types";

type DocumentTerm = {
  id?: string;
  number?: string;
  proposalNumber: string;
  proposalRevision: number;
  clientName: string;
  contact: string;
  clientEmail: string;
  site: string;
  title: string;
  deliveryDate: string;
  status: string;
  items: ProposalItem[];
  sections: DeliveryTermSection[];
};

export type DeliveryTermDocumentProps = {
  term: DocumentTerm;
  settings: { companyName: string; legalName: string; cnpj: string; crea: string; address: string; phone: string; email: string };
  edit?: unknown;
};

const datePt = (value: string) => {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
};

export function DeliveryTermDocument({ term, settings }: DeliveryTermDocumentProps) {
  return (
    <article className="delivery-doc">
      <header className="delivery-head">
        <div className="delivery-brand-mark">CTS</div>
        <div className="delivery-brand">
          <div className="delivery-company">{settings.companyName}</div>
          <div className="delivery-legal">{settings.legalName} · CNPJ {settings.cnpj} · {settings.crea}</div>
          <div className="delivery-contact">{settings.address} · {settings.phone} · {settings.email}</div>
        </div>
        <div className="delivery-number">
          <span>TERMO DE ENTREGA</span>
          <strong>{term.number ?? "RASCUNHO"}</strong>
        </div>
      </header>
      <div className="delivery-rule" />

      <div className="delivery-title-row">
        <div>
          <p className="delivery-kicker">DOCUMENTO DE ENTREGA E ACEITE</p>
          <h1>{term.title}</h1>
        </div>
        <div className={`delivery-status ${term.status}`}>{term.status}</div>
      </div>

      <section className="delivery-parties">
        <div><span>CLIENTE / CONTRATANTE</span><strong>{term.clientName || "A preencher"}</strong></div>
        <div><span>REPRESENTANTE</span><strong>{term.contact || "A preencher"}</strong></div>
        <div><span>LOCAL DA ENTREGA</span><strong>{term.site || "A preencher"}</strong></div>
        <div><span>DATA DA ENTREGA</span><strong>{datePt(term.deliveryDate)}</strong></div>
        <div><span>PROPOSTA DE REFERÊNCIA</span><strong>{term.proposalNumber} · revisão {term.proposalRevision}</strong></div>
        <div><span>CONTATO</span><strong>{term.clientEmail || "A preencher"}</strong></div>
      </section>

      <main className="delivery-content">
        {term.sections.map((section) => (
          <section key={section.id} className="delivery-section">
            <div className="delivery-section-title"><span>{section.title}</span><i /></div>
            {section.id === "itens" && term.items.length ? (
              <>
                <p className="delivery-paragraph">Relação dos equipamentos e serviços previstos na proposta vinculada. Conferir e registrar qualquer divergência nas ressalvas.</p>
                <div className="delivery-table-wrap">
                  <table className="delivery-table">
                    <thead><tr><th style={{ width: "8%" }}>ITEM</th><th style={{ width: "43%" }}>DESCRIÇÃO / ESPECIFICAÇÃO</th><th style={{ width: "10%" }}>UN.</th><th style={{ width: "12%" }}>QTD.</th><th>CONFERÊNCIA</th></tr></thead>
                    <tbody>
                      {term.items.map((item, index) => (
                        <tr key={item.id}>
                          <td>{String(index + 1).padStart(2, "0")}</td>
                          <td><strong>{item.desc}</strong>{item.spec ? <small>{item.spec}</small> : null}</td>
                          <td>{item.unit}</td>
                          <td>{item.qty}</td>
                          <td><span className="delivery-check">☐ Conforme &nbsp;&nbsp; ☐ Ressalva</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
            {section.id !== "itens" ? (
              <div className="delivery-body">
                {section.body.split(/\r?\n/).map((line, index) => {
                  const value = line.trim();
                  if (!value) return <div key={index} className="delivery-gap" />;
                  if (/^•\s/.test(value)) return <p key={index} className="delivery-bullet"><b>•</b>{value.replace(/^•\s/, "")}</p>;
                  return <p key={index} className="delivery-paragraph">{value}</p>;
                })}
              </div>
            ) : section.body ? (
              <div className="delivery-body">{section.body.split(/\r?\n/).map((line, i) => line.trim() ? <p key={i} className="delivery-paragraph">{line}</p> : <div key={i} className="delivery-gap" />)}</div>
            ) : null}
          </section>
        ))}

        <section className="delivery-signatures">
          <div><i /><strong>{settings.companyName}</strong><span>Responsável pela entrega · nome, assinatura e data</span></div>
          <div><i /><strong>{term.clientName || "Contratante"}</strong><span>Responsável pelo recebimento · nome, assinatura e data</span></div>
        </section>
        <p className="delivery-disclaimer">Este termo registra somente a entrega, conferência e ressalvas descritas acima. Anexos e condições comerciais permanecem vinculados à proposta e ao contrato eventualmente firmado.</p>
      </main>

      <footer className="delivery-footer">
        <span>{settings.companyName} · {settings.legalName}</span>
        <span>{term.proposalNumber} · {term.number ?? "Rascunho"}</span>
        <span>{settings.phone} · {settings.email}</span>
      </footer>
    </article>
  );
}
