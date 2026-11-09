"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CiprianoDocumentFooter, type DocumentFooterData } from "./DocumentChrome";
import { paginateContent } from "./paginate";
import { cleanupPrint, preparePrint } from "./export";
import "./a4.css";

export function A4Document({
  id,
  header,
  footer,
  children,
  className = "",
}: {
  id: string;
  header: ReactNode;
  footer: DocumentFooterData;
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const measurePageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    const timer = window.setTimeout(async () => {
      try {
        if (document.fonts?.ready) await document.fonts.ready;
        const page = measurePageRef.current;
        const content = contentRef.current;
        if (cancelled || !page || !content) return;
        await Promise.all(Array.from(page.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));
        if (cancelled) return;
        const headerHeight = page.querySelector<HTMLElement>(".a4-header")?.getBoundingClientRect().height ?? 0;
        const footerHeight = page.querySelector<HTMLElement>(".a4-footer")?.getBoundingClientRect().height ?? 0;
        const style = getComputedStyle(content);
        const padding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
        const capacity = Math.floor(page.getBoundingClientRect().height - headerHeight - footerHeight - padding - 4);
        if (capacity < 120) throw new Error("Área útil A4 insuficiente.");
        const result = paginateContent(content, capacity);
        if (cancelled) return;
        setPages(result.pages);
        setReady(true);
      } catch (error) {
        console.error("Falha ao paginar documento A4", error);
        if (!cancelled) setReady(false);
      }
    }, 120);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [children, header, footer, id]);

  useEffect(() => {
    if (!ready) return;
    window.dispatchEvent(new CustomEvent("a4-document-ready", { detail: { id } }));
    const before = () => { if (rootRef.current) preparePrint(rootRef.current); };
    const after = () => cleanupPrint();
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [ready, id]);

  return (
    <div ref={rootRef} id={id} className={`a4-document-root ${ready ? "is-ready" : "is-paginating"} ${className}`} data-ready={ready} data-page-count={pages.length}>
      <div className="a4-pages">
        {pages.length ? pages.map((html, index) => (
          <section key={index} className="a4-page" data-page={index + 1} aria-label={`Página ${index + 1} de ${pages.length}`}>
            {header}
            <div className="a4-content" dangerouslySetInnerHTML={{ __html: html }} />
            <CiprianoDocumentFooter data={footer} page={index + 1} total={pages.length} />
          </section>
        )) : (
          <div className="a4-loading" role="status">
            <span className="a4-loading-mark" />
            Preparando folhas A4, cabeçalhos e rodapé numerado…
          </div>
        )}
      </div>
      <div className="a4-measure" aria-hidden="true">
        <div ref={measurePageRef} className="a4-page a4-measure-page">
          {header}
          <div ref={contentRef} className="a4-content">{children}</div>
          <CiprianoDocumentFooter data={footer} page={1} total={1} />
        </div>
      </div>
    </div>
  );
}
