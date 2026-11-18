import "./doc.css";
import { brl, fmtDate } from "@/lib/brand";
import { LogoMark } from "@/components/ui/Logo";
import { InlineArea, InlineNumber, InlineText } from "@/components/ui/Inline";
import { calcTotals, typeLabels } from "@/lib/proposal/catalog";
import type {
  ProposalItem,
  ProposalSection,
  ProposalType,
  SectionTableRow,
  ValueBlockConfig,
} from "@/lib/proposal/types";
import { isMaintenanceProposal, maintenanceSummary } from "@/lib/proposal/maintenance-plan";
import { clampEntryPct, clampInstallments, MAX_INSTALLMENTS, resolveValueBlock } from "@/lib/proposal/value-block";

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

/** Ações de edição direta. Quando informado, todo texto do documento vira editável. */
export type DocEdit = {
  section: (id: string, patch: Partial<ProposalSection>) => void;
  row: (sectionId: string, index: number, patch: Partial<SectionTableRow>) => void;
  proposal: (patch: Partial<DocData>) => void;
  value: (patch: Partial<ValueBlockConfig>) => void;
  item: (id: string, patch: Partial<ProposalItem>) => void;
  briefing: (patch: Record<string, unknown>) => void;
};

function Body({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
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

function ItemsTable({ items, edit }: { items: ProposalItem[]; edit?: DocEdit }) {
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
                      <InlineText
                        editable={Boolean(edit)}
                        className="cip-item-title"
                        value={item.desc}
                        onChange={edit && ((v) => edit.item(item.id, { desc: v }))}
                      />
                      <InlineText
                        editable={Boolean(edit)}
                        className="cip-item-spec"
                        value={item.spec}
                        placeholder="Especificação técnica"
                        onChange={edit && ((v) => edit.item(item.id, { spec: v }))}
                      />
                    </td>
                    <td>
                      <InlineText
                        editable={Boolean(edit)}
                        value={item.unit}
                        placeholder="un"
                        onChange={edit && ((v) => edit.item(item.id, { unit: v }))}
                      />
                    </td>
                    <td className="num">
                      <InlineNumber
                        editable={Boolean(edit)}
                        value={item.qty}
                        min={0}
                        align="right"
                        onChange={edit && ((v) => edit.item(item.id, { qty: v }))}
                      />
                    </td>
                    <td className="num">
                      {edit ? (
                        <InlineNumber
                          editable
                          value={item.price}
                          min={0}
                          step={0.01}
                          align="right"
                          className="cip-inline-price"
                          onChange={(v) => edit.item(item.id, { price: v })}
                        />
                      ) : (
                        brl(item.price)
                      )}
                    </td>
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

/** Lê as condições do corpo: parágrafos introdutórios e linhas "• Rótulo: valor". */
function parseConditions(
  section: ProposalSection,
  proposal: DocData,
  maintenance: boolean,
): { intro: string[]; rows: [string, string][] } {
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
      rows.push(["", clean]);
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
  return { intro, rows };
}

function ConditionsBlock({
  section,
  proposal,
  maintenance,
  edit,
}: {
  section: ProposalSection;
  proposal: DocData;
  maintenance: boolean;
  edit?: DocEdit;
}) {
  const { intro, rows } = parseConditions(section, proposal, maintenance);

  if (!edit) {
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

  // Edição direta: cada linha é reescrita no corpo do bloco, mantendo o formato "• Rótulo: valor".
  const commit = (nextIntro: string[], nextRows: [string, string][]) =>
    edit.section(section.id, {
      body: [
        ...nextIntro,
        ...nextRows.map(([label, value]) => (label ? `• ${label}: ${value}` : `• ${value}`)),
      ].join("\n"),
    });

  return (
    <>
      <InlineArea
        editable
        value={intro.join("\n")}
        placeholder="Texto introdutório das condições"
        onChange={(v) => commit(v.split("\n"), rows)}
      />
      <div className="cip-terms" style={{ marginTop: 6 }}>
        {rows.map(([label, value], i) => (
          <div className="cip-term-row cip-term-row-edit" key={i}>
            <b>
              <InlineText
                editable
                value={label}
                placeholder="Condição"
                onChange={(v) => commit(intro, rows.map((r, j) => (j === i ? [v, r[1]] : r)))}
              />
            </b>
            <span className="cip-term-value">
              <InlineText
                editable
                value={value}
                onChange={(v) => commit(intro, rows.map((r, j) => (j === i ? [r[0], v] : r)))}
              />
              <button
                type="button"
                className="no-print cip-mini-remove"
                title="Remover condição"
                onClick={() => commit(intro, rows.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </span>
          </div>
        ))}
        <button
          type="button"
          className="no-print cip-add-row"
          onClick={() => commit(intro, [...rows, ["Nova condição", "Descreva a condição"]])}
        >
          + adicionar condição
        </button>
      </div>
    </>
  );
}

export function ProposalDocument({
  proposal,
  settings,
  edit,
}: {
  proposal: DocData;
  settings: DocSettings;
  edit?: DocEdit;
}) {
  const editable = Boolean(edit);
  const maintenance = isMaintenanceProposal(proposal.briefing);
  const monthly = maintenanceSummary(proposal.items, proposal.discountPct, proposal.briefing);
  const valueBlock = resolveValueBlock({
    briefing: proposal.briefing,
    maintenance,
    itemCount: proposal.items.length,
    discountPct: proposal.discountPct,
    months: monthly.months,
  });
  const totals = calcTotals(proposal.items, proposal.discountPct, valueBlock.installments);
  const enabled = proposal.sections.filter((s) => s.enabled);
  const briefing = (proposal.briefing ?? {}) as Record<string, unknown>;
  const customKicker = typeof briefing.customKicker === "string" ? briefing.customKicker : "";
  const kickerDefault = maintenance
    ? "Proposta de manutenção mensal"
    : typeLabels[(proposal.type as ProposalType) ?? "completa"] ?? "Proposta comercial";
  const sigCipriano =
    typeof briefing.signatureCipriano === "string" && briefing.signatureCipriano
      ? briefing.signatureCipriano
      : `${settings.legalName} · ${settings.director}`;
  const sigClient =
    typeof briefing.signatureClient === "string" && briefing.signatureClient
      ? briefing.signatureClient
      : `${proposal.clientName} · responsável pelo aceite`;

  const entry = clampEntryPct(valueBlock.entryPct);
  const installments = clampInstallments(valueBlock.installments);
  const total = maintenance ? totals.totalCents : totals.totalCents;
  const entryCents = Math.round((total * entry) / 100);
  const perInstallment = Math.round(total / installments);

  const setValue = edit ? (patch: Partial<ValueBlockConfig>) => edit.value(patch) : undefined;

  return (
    <article className="cip-doc" id="proposal-document">
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
          <InlineText
            editable={editable}
            className="cip-head-kicker"
            value={customKicker || kickerDefault}
            align="right"
            onChange={edit && ((v) => edit.briefing({ customKicker: v }))}
          />
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
            <InlineText
              editable={editable}
              value={proposal.clientName}
              placeholder="Nome do cliente"
              onChange={edit && ((v) => edit.proposal({ clientName: v }))}
            />
            {editable || proposal.clientEmail ? (
              <small>
                <InlineText
                  editable={editable}
                  value={proposal.clientEmail ?? ""}
                  placeholder="e-mail do cliente"
                  onChange={edit && ((v) => edit.proposal({ clientEmail: v }))}
                />
              </small>
            ) : null}
          </div>
        </div>
        <div>
          <div className="cip-strip-label">Contato</div>
          <div className="cip-strip-value">
            <InlineText
              editable={editable}
              value={proposal.contact ?? ""}
              placeholder="—"
              onChange={edit && ((v) => edit.proposal({ contact: v }))}
            />
          </div>
        </div>
        <div>
          <div className="cip-strip-label">{maintenance ? "Local de atendimento" : "Local de instalação"}</div>
          <div className="cip-strip-value">
            <InlineText
              editable={editable}
              value={proposal.site ?? ""}
              placeholder="A confirmar"
              onChange={edit && ((v) => edit.proposal({ site: v }))}
            />
          </div>
        </div>
      </section>

      <div className="cip-body">
        {enabled.map((section, index) => (
          <section className="cip-sec" key={section.id}>
            <div className="cip-sec-head">
              <span className="cip-sec-num">{String(index + 1).padStart(2, "0")}</span>
              <InlineText
                editable={editable}
                className="cip-sec-title"
                value={section.title}
                style={{ width: `${Math.max(10, section.title.length + 2)}ch`, flex: "none" }}
                onChange={edit && ((v) => edit.section(section.id, { title: v }))}
              />
              <span className="cip-sec-line" />
            </div>

            {section.kind === "table" && section.rows ? (
              <>
                <InlineArea
                  editable={editable}
                  value={section.body}
                  onChange={edit && ((v) => edit.section(section.id, { body: v }))}
                >
                  <Body text={section.body} />
                </InlineArea>
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
                        <td>
                          <InlineText editable={editable} value={row.label} onChange={edit && ((v) => edit.row(section.id, i, { label: v }))} />
                        </td>
                        <td>
                          <InlineText editable={editable} value={row.cipriano} onChange={edit && ((v) => edit.row(section.id, i, { cipriano: v }))} />
                        </td>
                        <td>
                          <InlineText editable={editable} value={row.client} onChange={edit && ((v) => edit.row(section.id, i, { client: v }))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : section.kind === "terms" ? (
              <ConditionsBlock section={section} proposal={proposal} maintenance={maintenance} edit={edit} />
            ) : (
              <InlineArea
                editable={editable}
                value={section.body}
                placeholder="Texto do bloco"
                onChange={edit && ((v) => edit.section(section.id, { body: v }))}
              >
                <Body text={section.body} />
              </InlineArea>
            )}

            {section.kind === "items" ? <ItemsTable items={proposal.items} edit={edit} /> : null}

            {section.kind === "totals" ? (
              <>
                <div className="cip-totals">
                  <div>
                    <InlineText
                      editable={editable}
                      className="cip-t-label"
                      value={valueBlock.primaryLabel}
                      onChange={setValue && ((v) => setValue({ primaryLabel: v }))}
                    />
                    <div className="cip-t-big">
                      {brl((maintenance ? monthly.monthlyCents : totals.totalCents) / 100)}
                      {maintenance ? " / mês" : ""}
                    </div>
                    <InlineText
                      editable={editable}
                      className="cip-t-sub"
                      value={valueBlock.primaryNote}
                      onChange={setValue && ((v) => setValue({ primaryNote: v }))}
                    />
                  </div>
                  <div>
                    <InlineText
                      editable={editable}
                      className="cip-t-label"
                      value={valueBlock.resumoLabel}
                      onChange={setValue && ((v) => setValue({ resumoLabel: v }))}
                    />
                    <div className="cip-mini">
                      <span>
                        <InlineText
                          editable={editable}
                          value={valueBlock.subtotalLabel}
                          onChange={setValue && ((v) => setValue({ subtotalLabel: v }))}
                        />
                      </span>
                      <span>{brl(totals.subtotalCents / 100)}</span>
                    </div>
                    <div className="cip-mini">
                      <span>
                        <InlineText
                          editable={editable}
                          value={valueBlock.discountLabel}
                          onChange={setValue && ((v) => setValue({ discountLabel: v }))}
                        />
                      </span>
                      <span>− {brl(totals.offCents / 100)}</span>
                    </div>
                    <div className="cip-mini">
                      <span className="cip-inline-row">
                        {maintenance ? (
                          <InlineText
                            editable={editable}
                            value={valueBlock.installmentLabel}
                            onChange={setValue && ((v) => setValue({ installmentLabel: v }))}
                          />
                        ) : (
                          <>
                            <InlineNumber
                              editable={editable}
                              value={installments}
                              min={1}
                              max={MAX_INSTALLMENTS}
                              suffix="×"
                              onChange={setValue && ((v) => setValue({ installments: Math.round(v) }))}
                            />
                            <InlineText
                              editable={editable}
                              value={valueBlock.installmentLabel}
                              onChange={setValue && ((v) => setValue({ installmentLabel: v }))}
                            />
                          </>
                        )}
                      </span>
                      <span>{brl((maintenance ? totals.totalCents : totals.installmentCents) / 100)}</span>
                    </div>
                  </div>
                </div>

                {!maintenance ? (
                  <div className="cip-terms cip-pay">
                    <div className="cip-group">
                      <InlineText
                        editable={editable}
                        value={valueBlock.paymentTitle}
                        onChange={setValue && ((v) => setValue({ paymentTitle: v }))}
                      />
                    </div>
                    {entry > 0 ? (
                      <div className="cip-term-row">
                        <b className="cip-inline-row">
                          <InlineText
                            editable={editable}
                            value={valueBlock.entryLabel}
                            onChange={setValue && ((v) => setValue({ entryLabel: v }))}
                          />
                          <InlineNumber
                            editable={editable}
                            value={entry}
                            min={0}
                            max={100}
                            suffix="%"
                            onChange={setValue && ((v) => setValue({ entryPct: Math.round(v) }))}
                          />
                        </b>
                        <span>{brl(entryCents / 100)} na assinatura</span>
                      </div>
                    ) : null}
                    {entry < 100 ? (
                      <div className="cip-term-row">
                        <b className="cip-inline-row">
                          <InlineText
                            editable={editable}
                            value={valueBlock.balanceLabel}
                            onChange={setValue && ((v) => setValue({ balanceLabel: v }))}
                          />
                          <span>{100 - entry}%</span>
                        </b>
                        <span>{brl((total - entryCents) / 100)} na entrega técnica</span>
                      </div>
                    ) : null}
                    <div className="cip-term-row">
                      <b>
                        <InlineText
                          editable={editable}
                          value={valueBlock.cardLabel}
                          onChange={setValue && ((v) => setValue({ cardLabel: v }))}
                        />
                      </b>
                      <span>
                        {installments === 1
                          ? `à vista · ${brl(total / 100)}`
                          : `${installments}× de ${brl(perInstallment / 100)} sem juros`}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="cip-mini-grid">
                  <div className="cip-mini">
                    <span>
                      <InlineText
                        editable={editable}
                        value={valueBlock.paymentLabel}
                        onChange={setValue && ((v) => setValue({ paymentLabel: v }))}
                      />
                    </span>
                    <span>
                      <InlineText
                        editable={editable}
                        align="right"
                        value={proposal.paymentTerms ?? ""}
                        placeholder="A combinar"
                        onChange={edit && ((v) => edit.proposal({ paymentTerms: v }))}
                      />
                    </span>
                  </div>
                  <div className="cip-mini">
                    <span>
                      <InlineText
                        editable={editable}
                        value={valueBlock.deadlineLabel}
                        onChange={setValue && ((v) => setValue({ deadlineLabel: v }))}
                      />
                    </span>
                    <span>
                      <InlineText
                        editable={editable}
                        align="right"
                        value={proposal.deliveryTime ?? ""}
                        placeholder="A combinar"
                        onChange={edit && ((v) => edit.proposal({ deliveryTime: v }))}
                      />
                    </span>
                  </div>
                  <div className="cip-mini">
                    <span>
                      <InlineText
                        editable={editable}
                        value={valueBlock.warrantyLabel}
                        onChange={setValue && ((v) => setValue({ warrantyLabel: v }))}
                      />
                    </span>
                    <span>
                      <InlineText
                        editable={editable}
                        align="right"
                        value={proposal.warranty ?? ""}
                        placeholder="A combinar"
                        onChange={edit && ((v) => edit.proposal({ warranty: v }))}
                      />
                    </span>
                  </div>
                  <div className="cip-mini">
                    <span>
                      <InlineText
                        editable={editable}
                        value={valueBlock.validityLabel}
                        onChange={setValue && ((v) => setValue({ validityLabel: v }))}
                      />
                    </span>
                    <span className="cip-inline-row">
                      <InlineNumber
                        editable={editable}
                        value={proposal.validityDays}
                        min={1}
                        max={365}
                        suffix=" dias"
                        align="right"
                        onChange={edit && ((v) => edit.proposal({ validityDays: Math.round(v) }))}
                      />
                    </span>
                  </div>
                </div>
              </>
            ) : null}

            {section.id === "aceite" ? (
              <div className="cip-sign">
                <div className="cip-sign-line">
                  <InlineText
                    editable={editable}
                    value={sigCipriano}
                    onChange={edit && ((v) => edit.briefing({ signatureCipriano: v }))}
                  />
                </div>
                <div className="cip-sign-line">
                  <InlineText
                    editable={editable}
                    value={sigClient}
                    onChange={edit && ((v) => edit.briefing({ signatureClient: v }))}
                  />
                </div>
              </div>
            ) : null}
          </section>
        ))}

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
