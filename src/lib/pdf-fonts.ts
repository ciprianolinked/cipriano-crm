import type { jsPDF } from "jspdf";

/** Static, licensed TTF files shared by browser documents and generated PDFs. */
export const PDF_FONT_FILES = [
  { file: "IBMPlexSans-Regular.ttf", family: "CiprianoSans", style: "normal" },
  { file: "IBMPlexSans-SemiBold.ttf", family: "CiprianoSans", style: "bold" },
  { file: "IBMPlexMono-SemiBold.ttf", family: "CiprianoMono", style: "bold" },
  { file: "SpaceGrotesk-Bold.ttf", family: "CiprianoDisplay", style: "bold" },
] as const;

export const PDF_FONTS = { body: "CiprianoSans", mono: "CiprianoMono", display: "CiprianoDisplay" } as const;

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

export function registerPdfFonts(pdf: jsPDF, files: Record<string, Uint8Array>) {
  for (const font of PDF_FONT_FILES) {
    const data = files[font.file];
    if (!data || data.length < 4 || data[0] !== 0 || data[1] !== 1) {
      throw new Error(`Fonte de documento inválida: ${font.file}`);
    }
    pdf.addFileToVFS(font.file, base64(data));
    pdf.addFont(font.file, font.family, font.style);
  }
  // The technical labels always use the semibold cut, including callers using "normal".
  pdf.addFont("IBMPlexMono-SemiBold.ttf", PDF_FONTS.mono, "normal");
  pdf.setFont(PDF_FONTS.body, "normal");
}

let fontFiles: Promise<Record<string, Uint8Array>> | null = null;

/** Load once per browser session, then embed in every new PDF before measuring text. */
export async function loadDocumentFonts(pdf: jsPDF): Promise<void> {
  if (!fontFiles) {
    fontFiles = Promise.all(PDF_FONT_FILES.map(async ({ file }) => {
      const response = await fetch(`/fonts/${file}`, { cache: "force-cache", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Não foi possível carregar a fonte ${file}.`);
      return [file, new Uint8Array(await response.arrayBuffer())] as const;
    })).then((entries) => Object.fromEntries(entries)).catch((error) => {
      fontFiles = null; // Permit a later retry after an interrupted download.
      throw error;
    });
  }
  registerPdfFonts(pdf, await fontFiles);
}
