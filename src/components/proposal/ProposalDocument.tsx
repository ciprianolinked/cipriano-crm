"use client";

import "./doc.css";
import { useState } from "react";
import { brl, fmtDate } from "@/lib/brand";
import { LogoMark } from "@/components/ui/Logo";
import { calcTotals, typeLabels } from "@/lib/proposal/catalog";
import { AUTO_GROUP_LABEL, autoItemNote, type ProposalExtras } from "@/lib/proposal/extras";
import { DEFAULT_SEALS, readDocTexts, tx } from "@/lib/proposal/doc-text";
import { getPaymentInstallments, installmentAmount, parseInstallments } from "@/lib/proposal/payment";
import type { ItemKind, ProposalItem, ProposalSection, ProposalType, SectionTableRow } from "@/lib/proposal/types";
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

/** Ações de edição direta no documento. Sem este objeto o documento é somente leitura (impressão/PDF). */
export type DocEdit = {
  text: (key: string, value: string) => void;
  field: (patch: Partial<Pick<DocData, "clientName" | "contact" | "clientEmail" | "site" | "paymentTerms" | "deliveryTime" | "warranty" | "validityDays">> & { paymentInstallments?: number }) => void;
  section: (id: string, patch: Partial<ProposalSection>) => void;
  item: (id: string, patch: Partial<ProposalItem>) => void;
  removeItem: (item: ProposalItem) => void;
  addItem: (kind: ItemKind) => void;
  renameScope: (from: string, to: string) => void;
  extras: (patch: Partial<ProposalExtras>) => void;
};

function BrandMark({ size = 38 }: { size?: number }) {
  return <LogoMark height={size} />;
}

/** "R$ 1.290,00", "1.290,50", "1290.5" ou "1.290" → número. */
function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.\-]/g, "");
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(",")) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) normalized = cleaned.replace(/\./g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Texto editável em linha (um clique, Enter confirma, Esc cancela). Fora do modo de edição é texto puro. */
function E({
  value,
  onCommit,
  edit,
  placeholder,
  multiline = false,
}: {
  value: string;
  onCommit: (value: string) => boolean | void;
  edit: boolean;
  placeholder?: string;
  multiline?: boolean;
}) {
  if (!edit) return <>{value}</>;
  return (
    <span
      className="cip-ed"
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder ?? "editar"}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !multiline) {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.currentTarget.textContent = value;
          event.currentTarget.blur();
        }
      }}
      onPaste={(event) => {
        event.preventDefault();
        const plain = event.clipboardData.getData("text/plain").replace(/\r?\n/g, " ");
        document.execCommand("insertText", false, plain);
      }}
      onBlur={(event) => {
        const next = (event.currentTarget.innerText ?? "").replace(/\u00a0/g, " ").replace(/\s*\n\s*/g, " ").trim();
        if (next === value) return;
        if (onCommit(next) === false) event.currentTarget.textContent = value;
      }}
    >
      {value}
    </span>
  );
}

/** Número editável: mostra `display` e grava o valor interpretado. */
function EN({
  display,
  onCommit,
  edit,
}: {
  display: string;
  onCommit: (value: number) => void;
  edit: boolean;
}) {
  return (
    <E
      value={display}
      edit={edit}
      placeholder="0"
      onCommit={(raw) => {
        const parsed = parseNumber(raw);
        if (parsed === null || parsed < 0) return false;
        onCommit(parsed);
      }}
    />
  );
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

/** Texto de bloco: no modo de edição, um clique abre a caixa de texto (uma linha por parágrafo/marcador). */
function BodyBlock({ text, edit, onCommit }: { text: string; edit: boolean; onCommit: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (!edit) return <Body text={text} />;
  if (!editing) {
    return (
      <div
        className="cip-edit-block"
        role="button"
        tabIndex={0}
        title="Clique para editar este texto"
        onClick={() => setEditing(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") setEditing(true);
        }}
      >
        {text.trim() ? <Body text={text} /> : <p className="cip-p cip-empty">Clique para escrever o texto deste bloco…</p>}
      </div>
    );
  }
  const fit = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 4}px`;
  };
  return (
    <div className="cip-x">
      <textarea
        className="cip-textarea"
        autoFocus
        defaultValue={text}
        ref={(el) => {
          if (el) fit(el);
        }}
        onInput={(event) => fit(event.currentTarget)}
        onBlur={(event) => {
          setEditing(false);
          if (event.currentTarget.value !== text) onCommit(event.currentTarget.value);
        }}
      />
      <div className="cip-hint">Uma linha por parágrafo. Comece a linha com “• ” para criar marcadores. Clique fora para confirmar.</div>
    </div>
  );
}

type Group = { key: string; label: string; rows: ProposalItem[]; labelKey?: string; scope?: string; auto?: boolean };

function ItemsTable({
  items,
  texts,
  edit,
}: {
  items: ProposalItem[];
  texts: Record<string, string>;
  edit?: DocEdit;
}) {
  const t = (key: string, fallback: string) => tx(texts, key, fallback);
  const T = (key: string, fallback: string) => (
    <E value={t(key, fallback)} edit={Boolean(edit)} onCommit={(v) => edit?.text(key, v)} />
  );
  const regular = items.filter((item) => !item.auto);
  const automatic = items.filter((item) => item.auto);
  const hasScope = regular.some((item) => Boolean(item.scope));
  const groups: Group[] = [];
  if (hasScope) {
    // Proposta igualada ao concorrente: agrupa por disciplina.
    for (const item of regular) {
      const label = item.scope?.trim() || "Itens Complementares";
      const key = `scope-${label}`;
      const existing = groups.find((group) => group.key === key);
      if (existing) existing.rows.push(item);
      else groups.push({ key, label, rows: [item], scope: label });
    }
  } else {
    groups.push(
      { key: "equipamento", label: t("groupEquip", "Equipamentos"), labelKey: "groupEquip", rows: regular.filter((item) => item.kind === "equipamento") },
      { key: "servico", label: t("groupServ", "Serviços"), labelKey: "groupServ", rows: regular.filter((item) => item.kind === "servico") },
    );
  }
  if (automatic.length) {
    groups.push({ key: "auto", label: t("groupExtras", AUTO_GROUP_LABEL), labelKey: "groupExtras", rows: automatic, auto: true });
  }

  const pctKey = { misc: "miscPct", infra: "infraPct", safety: "safetyPct" } as const;
  const removeAuto = (item: ProposalItem) => edit?.removeItem(item);

  return (
    <>
      {groups.map((group) => {
        const rows = group.rows;
        if (rows.length === 0) return null;
        const total = rows.reduce((acc, item) => acc + item.qty * item.price, 0);
        return (
          <div key={group.key} className="cip-group-wrap">
            <div className="cip-group">
              {group.labelKey ? (
                <E value={group.label} edit={Boolean(edit)} onCommit={(v) => edit?.text(group.labelKey!, v)} />
              ) : (
                <E value={group.label} edit={Boolean(edit)} onCommit={(v) => (v ? edit?.renameScope(group.scope ?? group.label, v) : false)} />
              )}
            </div>
            <table className="cip-table">
              <thead>
                <tr>
                  <th style={{ width: "46%" }}>{T("colDesc", "Descrição / especificação")}</th>
                  <th style={{ width: "9%" }}>{T("colUn", "Un.")}</th>
                  <th className="num" style={{ width: "8%" }}>{T("colQty", "Qtd.")}</th>
                  <th className="num" style={{ width: "17%" }}>{T("colUnit", "Unitário")}</th>
                  <th className="num" style={{ width: "20%" }}>{T("colTotal", "Total")}</th>
                  {edit ? <th className="cip-x" style={{ width: 18 }} /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const locked = Boolean(item.auto);
                  const isLabor = item.auto === "labor";
                  const note = autoItemNote(item);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="cip-item-title">
                          <E value={item.desc} edit={Boolean(edit)} placeholder="descrição" onCommit={(v) => edit?.item(item.id, { desc: v })} />
                        </div>
                        {edit || item.spec ? (
                          <div className="cip-item-spec">
                            <E value={item.spec} edit={Boolean(edit)} placeholder="especificação técnica" onCommit={(v) => edit?.item(item.id, { spec: v })} />
                          </div>
                        ) : null}
                        {item.auto && item.auto !== "labor" ? (
                          <div className="cip-item-spec cip-item-auto">
                            {edit ? (
                              <>
                                <EN
                                  edit
                                  display={String(item.pct ?? 0).replace(".", ",")}
                                  onCommit={(v) => edit.extras({ [pctKey[item.auto as keyof typeof pctKey]]: Math.min(100, v) })}
                                />
                                % sobre o valor dos equipamentos
                              </>
                            ) : (
                              note
                            )}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <E value={item.unit} edit={Boolean(edit) && !locked} placeholder="un" onCommit={(v) => edit?.item(item.id, { unit: v })} />
                      </td>
                      <td className="num">
                        <EN edit={Boolean(edit) && !locked} display={String(item.qty).replace(".", ",")} onCommit={(v) => edit?.item(item.id, { qty: v })} />
                      </td>
                      <td className="num">
                        <EN
                          edit={Boolean(edit) && (!locked || isLabor)}
                          display={brl(item.price)}
                          onCommit={(v) => (isLabor ? edit?.extras({ laborValue: v }) : edit?.item(item.id, { price: v }))}
                        />
                      </td>
                      <td className="num">{brl(item.price * item.qty)}</td>
                      {edit ? (
                        <td className="cip-x">
                          <button type="button" className="cip-del" title="Remover linha" onClick={() => (locked ? removeAuto(item) : edit.removeItem(item))}>
                            ×
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
                <tr className="total">
                  <td colSpan={4}>
                    {T("subtotalLabel", "Subtotal")} · {group.label}
                  </td>
                  <td className="num">{brl(total)}</td>
                  {edit ? <td className="cip-x" /> : null}
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
      {edit ? (
        <div className="cip-x cip-add-row">
          <button type="button" className="cip-add" onClick={() => edit.addItem("equipamento")}>
            + equipamento
          </button>
          <button type="button" className="cip-add" onClick={() => edit.addItem("servico")}>
            + serviço
          </button>
        </div>
      ) : null}
    </>
  );
}

function ConditionsBlock({
  section,
  proposal,
  maintenance,
  texts,
  edit,
}: {
  section: ProposalSection;
  proposal: DocData;
  maintenance: boolean;
  texts: Record<string, string>;
  edit?: DocEdit;
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
  const fromBody = rows.length > 0;
  type Row = { label: string; value: string; labelKey?: string; commit: (value: string) => boolean | void };
  const display: Row[] = [];
  const rebuild = (nextRows: [string, string][]) =>
    [...intro, ...nextRows.map(([label, value]) => `• ${label}: ${value}`)].join("\n");

  if (fromBody) {
    rows.forEach(([label, value], index) => {
      display.push({
        label,
        value,
        commit: (next) => edit?.section(section.id, { body: rebuild(rows.map((row, i) => (i === index ? [row[0], next] : row)) as [string, string][]) }),
        labelKey: `__row${index}`,
      });
    });
  } else {
    const payment = intro.length ? intro.join(" ") : proposal.paymentTerms || "A combinar";
    intro.length = 0;
    display.push(
      { label: tx(texts, "termPay", "Pagamento"), labelKey: "termPay", value: payment, commit: (v) => edit?.field({ paymentTerms: v }) },
      { label: tx(texts, "termExec", maintenance ? "Serviços recorrentes" : "Execução"), labelKey: "termExec", value: proposal.deliveryTime || "A combinar", commit: (v) => edit?.field({ deliveryTime: v }) },
      { label: tx(texts, "termWarranty", "Garantia"), labelKey: "termWarranty", value: proposal.warranty || "A combinar", commit: (v) => edit?.field({ warranty: v }) },
      { label: tx(texts, "termValidity", "Validade"), labelKey: "termValidity", value: `${proposal.validityDays} dias corridos a partir da emissão`, commit: () => false },
    );
  }
  return (
    <>
      {intro.map((line, i) => (
        <p className="cip-p" key={i}>
          {line}
        </p>
      ))}
      <div className="cip-terms">
        {display.map((row, i) => (
          <div className="cip-term-row" key={i}>
            <b>
              {fromBody ? (
                <E
                  value={row.label}
                  edit={Boolean(edit)}
                  onCommit={(v) =>
                    edit?.section(section.id, { body: rebuild(rows.map((item, idx) => (idx === i ? [v, item[1]] : item)) as [string, string][]) })
                  }
                />
              ) : (
                <E value={row.label} edit={Boolean(edit)} onCommit={(v) => edit?.text(row.labelKey!, v)} />
              )}
            </b>
            <span>
              <E value={row.value} edit={Boolean(edit) && (fromBody || row.labelKey !== "termValidity")} onCommit={row.commit} />
            </span>
          </div>
        ))}
      </div>
      {edit && !fromBody ? (
        <div className="cip-x cip-hint">Validade: ajuste os dias no cabeçalho do documento.</div>
      ) : null}
    </>
  );
}

export function ProposalDocument({ proposal, settings, edit }: { proposal: DocData; settings: DocSettings; edit?: DocEdit }) {
  const editing = Boolean(edit);
  const texts = readDocTexts(proposal.briefing);
  const t = (key: string, fallback: string) => tx(texts, key, fallback);
  const T = (key: string, fallback: string) => <E value={t(key, fallback)} edit={editing} onCommit={(v) => edit?.text(key, v)} />;
  const totals = calcTotals(proposal.items, proposal.discountPct);
  const maintenance = isMaintenanceProposal(proposal.briefing);
  const monthly = maintenanceSummary(proposal.items, proposal.discountPct, proposal.briefing);
  const installments = getPaymentInstallments(proposal.briefing);
  const enabled = proposal.sections.filter((s) => s.enabled);
  const defaultKicker = maintenance ? "Proposta de manutenção mensal" : typeLabels[(proposal.type as ProposalType) ?? "completa"] ?? "Proposta comercial";
  const seals = DEFAULT_SEALS.map((tag, index) => ({ key: `seal${index}`, value: t(`seal${index}`, tag) })).filter((seal) => editing || seal.value.trim());

  const patchRow = (section: ProposalSection, index: number, patch: Partial<SectionTableRow>) =>
    edit?.section(section.id, { rows: (section.rows ?? []).map((row, i) => (i === index ? { ...row, ...patch } : row)) });
  const defaultColumns = ["Frente de trabalho", "Cipriano Tech & Security", "Cliente"];

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
            <div className="cip-brand-name">{T("brandName", "CIPRIANO")}</div>
            <div className="cip-brand-sub">{T("brandSub", "Tech & Security")}</div>
            <div className="cip-brand-tag">{T("tagline", settings.tagline)}</div>
          </div>
        </div>
        <div className="cip-head-meta">
          <div className="cip-head-kicker">{T("kicker", defaultKicker)}</div>
          <div className="cip-head-number">{proposal.number}</div>
          <div className="cip-meta-line">
            {T("lblIssue", "Emissão")} · {fmtDate(proposal.issuedAt)}
          </div>
          <div className="cip-meta-line">
            {T("lblValidity", "Validade")} ·{" "}
            <EN edit={editing} display={String(proposal.validityDays)} onCommit={(v) => edit?.field({ validityDays: Math.max(1, Math.round(v)) })} /> dias
          </div>
          <div className="cip-meta-line">{T("metaCrea", settings.crea)}</div>
        </div>
      </header>
      <div className="cip-rule" />

      <section className="cip-strip">
        <div>
          <div className="cip-strip-label">{T("stripClient", "Cliente")}</div>
          <div className="cip-strip-value">
            <E value={proposal.clientName} edit={editing} placeholder="nome do cliente" onCommit={(v) => (v ? edit?.field({ clientName: v }) : false)} />
            {proposal.clientEmail || editing ? (
              <small>
                <E value={proposal.clientEmail ?? ""} edit={editing} placeholder="e-mail" onCommit={(v) => edit?.field({ clientEmail: v })} />
              </small>
            ) : null}
          </div>
        </div>
        <div>
          <div className="cip-strip-label">{T("stripContact", "Contato")}</div>
          <div className="cip-strip-value">
            <E value={proposal.contact || (editing ? "" : "—")} edit={editing} placeholder="contato" onCommit={(v) => edit?.field({ contact: v })} />
          </div>
        </div>
        <div>
          <div className="cip-strip-label">{T("stripSite", maintenance ? "Local de atendimento" : "Local de instalação")}</div>
          <div className="cip-strip-value">
            <E value={proposal.site || (editing ? "" : "A confirmar")} edit={editing} placeholder="local" onCommit={(v) => edit?.field({ site: v })} />
          </div>
        </div>
      </section>

      <div className="cip-body">
        {enabled.map((section, index) => (
          <section className="cip-sec" key={section.id}>
            <div className="cip-sec-head">
              <span className="cip-sec-num">{String(index + 1).padStart(2, "0")}</span>
              <span className="cip-sec-title">
                <E value={section.title} edit={editing} placeholder="título do bloco" onCommit={(v) => (v ? edit?.section(section.id, { title: v }) : false)} />
              </span>
              <span className="cip-sec-line" />
            </div>

            {section.kind === "table" && section.rows ? (
              <>
                <BodyBlock text={section.body} edit={editing} onCommit={(body) => edit?.section(section.id, { body })} />
                <table className="cip-table cip-table-gap">
                  <thead>
                    <tr>
                      {[0, 1, 2].map((i) => (
                        <th key={i} style={i === 0 ? { width: "38%" } : i === 1 ? { width: "40%" } : undefined}>
                          <E
                            value={section.columns?.[i] ?? defaultColumns[i]}
                            edit={editing}
                            onCommit={(v) => edit?.section(section.id, { columns: [0, 1, 2].map((j) => (j === i ? v : section.columns?.[j] ?? defaultColumns[j])) })}
                          />
                        </th>
                      ))}
                      {editing ? <th className="cip-x" style={{ width: 18 }} /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <E value={row.label} edit={editing} placeholder="item" onCommit={(v) => patchRow(section, i, { label: v })} />
                        </td>
                        <td>
                          <E value={row.cipriano} edit={editing} placeholder="—" onCommit={(v) => patchRow(section, i, { cipriano: v })} />
                        </td>
                        <td>
                          <E value={row.client} edit={editing} placeholder="—" onCommit={(v) => patchRow(section, i, { client: v })} />
                        </td>
                        {editing ? (
                          <td className="cip-x">
                            <button
                              type="button"
                              className="cip-del"
                              title="Remover linha"
                              onClick={() => edit?.section(section.id, { rows: (section.rows ?? []).filter((_, idx) => idx !== i) })}
                            >
                              ×
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {editing ? (
                  <div className="cip-x cip-add-row">
                    <button
                      type="button"
                      className="cip-add"
                      onClick={() => edit?.section(section.id, { rows: [...(section.rows ?? []), { label: "Novo item", cipriano: "—", client: "—" }] })}
                    >
                      + linha
                    </button>
                  </div>
                ) : null}
              </>
            ) : section.kind === "terms" ? (
              <ConditionsBlock section={section} proposal={proposal} maintenance={maintenance} texts={texts} edit={edit} />
            ) : (
              <BodyBlock text={section.body} edit={editing} onCommit={(body) => edit?.section(section.id, { body })} />
            )}

            {section.kind === "items" ? <ItemsTable items={proposal.items} texts={texts} edit={edit} /> : null}

            {section.kind === "totals" ? (
              <>
                <div className="cip-totals">
                  <div>
                    <div className="cip-t-label">{T("totalsLabel", maintenance ? "Mensalidade da manutenção" : "Investimento total")}</div>
                    <div className="cip-t-big">{brl((maintenance ? monthly.monthlyCents : totals.totalCents) / 100)}{maintenance ? " / mês" : ""}</div>
                    <div className="cip-t-sub">
                      {editing || Object.prototype.hasOwnProperty.call(texts, "totalsSub") ? (
                        T("totalsSub", maintenance ? `${monthly.months} meses de vigência · ${proposal.discountPct}% de desconto` : `${proposal.items.length} itens · desconto comercial de ${proposal.discountPct}% aplicado`)
                      ) : maintenance ? (
                        `${monthly.months} meses de vigência · ${proposal.discountPct}% de desconto`
                      ) : (
                        `${proposal.items.length} itens · desconto comercial de ${proposal.discountPct}% aplicado`
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="cip-t-label">{T("totalsSummary", "Resumo")}</div>
                    <div className="cip-mini">
                      <span>{T("miniSubtotal", "Subtotal")}</span>
                      <span>{brl(totals.subtotalCents / 100)}</span>
                    </div>
                    <div className="cip-mini">
                      <span>{T("miniDiscount", "Desconto")}</span>
                      <span>− {brl(totals.offCents / 100)}</span>
                    </div>
                    <div className="cip-mini">
                      <span>
                        <E
                          value={t("miniFinal", maintenance ? "Total do período" : `${installments}× de`)}
                          edit={editing}
                          onCommit={(value) => {
                            const count = parseInstallments(value);
                            if (count !== null) {
                              edit?.field({ paymentInstallments: count });
                              edit?.text("miniFinal", value);
                            } else {
                              edit?.text("miniFinal", value);
                            }
                          }}
                        />
                      </span>
                      <span>{brl((maintenance ? totals.totalCents : installmentAmount(totals.totalCents, installments)) / 100)}</span>
                    </div>
                  </div>
                </div>
                <div className="cip-mini-grid">
                  <div className="cip-mini">
                    <span>{T("miniPay", "Pagamento")}</span>
                    <span>
                      <E value={proposal.paymentTerms || "A combinar"} edit={editing} onCommit={(v) => edit?.field({ paymentTerms: v })} />
                    </span>
                  </div>
                  <div className="cip-mini">
                    <span>{T("miniDelivery", "Prazo")}</span>
                    <span>
                      <E value={proposal.deliveryTime || "A combinar"} edit={editing} onCommit={(v) => edit?.field({ deliveryTime: v })} />
                    </span>
                  </div>
                  <div className="cip-mini">
                    <span>{T("miniWarranty", "Garantia")}</span>
                    <span>
                      <E value={proposal.warranty || "A combinar"} edit={editing} onCommit={(v) => edit?.field({ warranty: v })} />
                    </span>
                  </div>
                  <div className="cip-mini">
                    <span>{T("miniValidity", "Validade")}</span>
                    <span>
                      <EN edit={editing} display={String(proposal.validityDays)} onCommit={(v) => edit?.field({ validityDays: Math.max(1, Math.round(v)) })} /> dias
                    </span>
                  </div>
                </div>
              </>
            ) : null}

            {section.id === "aceite" ? (
              <div className="cip-sign">
                <div className="cip-sign-line">
                  <E value={t("signA", `${settings.legalName} · ${settings.director}`)} edit={editing} onCommit={(v) => edit?.text("signA", v)} />
                </div>
                <div className="cip-sign-line">
                  <E value={t("signB", `${proposal.clientName} · responsável pelo aceite`)} edit={editing} onCommit={(v) => edit?.text("signB", v)} />
                </div>
              </div>
            ) : null}
          </section>
        ))}

        <div className="cip-seal">
          {seals.map((seal) => (
            <span key={seal.key}>
              <E value={seal.value} edit={editing} placeholder="selo" onCommit={(v) => edit?.text(seal.key, v)} />
            </span>
          ))}
        </div>
      </div>

      <footer className="cip-foot">
        <div>
          {editing || Object.prototype.hasOwnProperty.call(texts, "footL1") ? (
            <E value={t("footL1", `${settings.companyName} · ${settings.legalName}`)} edit={editing} onCommit={(v) => edit?.text("footL1", v)} />
          ) : (
            <>
              <strong>{settings.companyName}</strong> · {settings.legalName}
            </>
          )}
          <br />
          <E value={t("footL2", `${settings.address} · CNPJ ${settings.cnpj}`)} edit={editing} onCommit={(v) => edit?.text("footL2", v)} />
        </div>
        <div style={{ textAlign: "right" }}>
          <E value={t("footR1", `${settings.phone} · ${settings.email}`)} edit={editing} onCommit={(v) => edit?.text("footR1", v)} />
          <br />
          <E value={t("footR2", `${settings.site} · ${settings.hours}`)} edit={editing} onCommit={(v) => edit?.text("footR2", v)} />
        </div>
      </footer>
    </article>
  );
}
