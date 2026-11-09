import { LogoMark } from "@/components/ui/Logo";

export type DocumentFooterData = {
  companyName: string;
  legalName?: string;
  address?: string;
  cnpj?: string;
  crea?: string;
  phone?: string;
  email?: string;
  site?: string;
  documentLabel: string;
  documentNumber: string;
  revision?: string;
  notice?: string;
};

export function CiprianoDocumentHeader({ title, number, meta, tagline }: { title: string; number: string; meta: string[]; tagline?: string }) {
  return (
    <header className="a4-header cip-head">
      <div className="cip-brand">
        <LogoMark height={54} />
        <div style={{ borderLeft: "1.5px solid rgba(0,229,255,0.85)", paddingLeft: 14, marginLeft: 2 }}>
          <div className="cip-brand-name">CIPRIANO</div>
          <div className="cip-brand-sub">Tech &amp; Security</div>
          {tagline ? <div className="cip-brand-tag">{tagline}</div> : null}
        </div>
      </div>
      <div className="cip-head-meta">
        <div className="cip-head-kicker">{title}</div>
        <div className="cip-head-number">{number}</div>
        {meta.map((line) => <div key={line} className="cip-meta-line">{line}</div>)}
      </div>
    </header>
  );
}

export function CiprianoDocumentFooter({ data, page, total }: { data: DocumentFooterData; page: number; total: number }) {
  const registry = [data.cnpj ? `CNPJ ${data.cnpj}` : "", data.crea ?? ""].filter(Boolean).join(" · ");
  return (
    <footer className="a4-footer">
      <div className="a4-footer-main">
        <div className="a4-footer-company">
          <strong>{data.companyName}</strong>
          {data.address ? <span>{data.address}</span> : null}
          {registry ? <span>{registry}</span> : null}
        </div>
        <div className="a4-footer-contact">
          {data.phone ? <span>{data.phone}</span> : null}
          {data.email ? <span>{data.email}</span> : null}
          {data.site ? <span>{data.site}</span> : null}
        </div>
      </div>
      <div className="a4-footer-meta">
        <span>{data.documentLabel} · {data.documentNumber}{data.revision ? ` · ${data.revision}` : ""}</span>
        <span className="a4-footer-page">Página <strong>{page}</strong> de <strong>{total}</strong></span>
      </div>
      {data.notice ? <div className="a4-footer-notice">{data.notice}</div> : null}
    </footer>
  );
}
