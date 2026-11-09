export type PdfMetadata = { title: string; subject?: string; author?: string; keywords?: string };

export function documentRoot(id: string): HTMLElement | null {
  return document.getElementById(id);
}

export async function waitForDocument(id: string, timeout = 20000): Promise<HTMLElement> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const root = documentRoot(id);
    if (root?.dataset.ready === "true" && root.querySelectorAll(".a4-pages > .a4-page").length) return root;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("O documento ainda está sendo paginado. Aguarde a prévia A4 ficar pronta e tente novamente.");
}

function pageElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(".a4-pages > .a4-page"));
}

function assertPages(root: HTMLElement): HTMLElement[] {
  const pages = pageElements(root);
  if (!pages.length) throw new Error("Nenhuma página A4 foi gerada.");
  pages.forEach((page, index) => {
    const content = page.querySelector<HTMLElement>(".a4-content");
    if (content && content.scrollHeight > content.clientHeight + 2) {
      throw new Error(`A página ${index + 1} excedeu a área A4. O PDF não foi gerado para evitar cortes.`);
    }
    const footer = page.querySelector(".a4-footer");
    if (!footer?.textContent?.replace(/\s+/g, " ").includes(`Página ${index + 1} de ${pages.length}`)) {
      throw new Error("O rodapé numerado não está pronto. Atualize a prévia e tente novamente.");
    }
  });
  return pages;
}

export async function downloadA4Pdf(root: HTMLElement, filename: string, metadata: PdfMetadata): Promise<void> {
  const pages = assertPages(root);
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  if (document.fonts?.ready) await document.fonts.ready;

  const host = document.createElement("div");
  host.className = "a4-export-host";
  host.setAttribute("aria-hidden", "true");
  document.body.appendChild(host);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  pdf.setProperties({
    title: metadata.title,
    subject: metadata.subject ?? "Documento comercial em formato A4",
    author: metadata.author ?? "Cipriano Tech & Security",
    creator: "Cipriano Tech & Security · Central comercial",
    keywords: metadata.keywords ?? "proposta, contrato, A4, Cipriano",
  });

  try {
    for (let index = 0; index < pages.length; index++) {
      const copy = pages[index].cloneNode(true) as HTMLElement;
      copy.removeAttribute("id");
      host.replaceChildren(copy);
      await Promise.all(Array.from(copy.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = await html2canvas(copy, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: copy.offsetWidth,
        height: copy.offsetHeight,
        windowWidth: Math.max(copy.offsetWidth, 1024),
      });
      if (index > 0) pdf.addPage([210, 297], "portrait");
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
      canvas.width = 0;
      canvas.height = 0;
    }
    pdf.save(filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`);
  } finally {
    host.remove();
  }
}

export function preparePrint(root: HTMLElement): void {
  const pages = assertPages(root);
  document.getElementById("a4-print-only")?.remove();
  const portal = document.createElement("div");
  portal.id = "a4-print-only";
  portal.className = "a4-print-portal";
  portal.setAttribute("aria-hidden", "true");
  pages.forEach((page) => {
    const copy = page.cloneNode(true) as HTMLElement;
    copy.removeAttribute("id");
    portal.appendChild(copy);
  });
  document.body.appendChild(portal);
}

export function cleanupPrint(): void {
  document.getElementById("a4-print-only")?.remove();
}

export async function printA4Document(id: string): Promise<void> {
  const root = await waitForDocument(id);
  preparePrint(root);
  await new Promise((resolve) => setTimeout(resolve, 80));
  window.print();
}
