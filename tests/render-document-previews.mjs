import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createCanvas, DOMMatrix, Path2D, ImageData } from "@napi-rs/canvas";
Object.assign(globalThis, { DOMMatrix, Path2D, ImageData });
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
class CanvasFactory {
  create(width, height) { const canvas = createCanvas(width, height); return { canvas, context: canvas.getContext("2d") }; }
  reset(target, width, height) { target.canvas.width = width; target.canvas.height = height; }
  destroy(target) { target.canvas.width = 0; target.canvas.height = 0; target.canvas = null; target.context = null; }
}
mkdirSync(".verification", { recursive: true });
for (const name of ["os", "proposta", "contrato", "entrega"]) {
  const bytes = readFileSync(`/tmp/cipriano-document-tests/${name}.pdf`);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), CanvasFactory, verbosity: 0, useSystemFonts: false }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  writeFileSync(`.verification/${name}-pdf.png`, canvas.toBuffer("image/png"));
  let textCount = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    textCount += content.items.length;
  }
  console.log(`${name}: ${doc.numPages} página(s), ${textCount} fragmentos de texto selecionável.`);
  await doc.destroy();
}
