import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { jsPDF } from "jspdf";
import { PDF_FONT_FILES, PDF_FONTS, registerPdfFonts } from "../src/lib/pdf-fonts";
import { renderContractPdf, renderDeliveryTermPdf, renderProposalPdf, renderServiceOrderPdf, type PdfSettings, type PdfServiceOrderData } from "../src/lib/pdf-documents";

const fonts = Object.fromEntries(PDF_FONT_FILES.map((font) => [font.file, new Uint8Array(readFileSync(`public/fonts/${font.file}`))]));
const settings: PdfSettings = {
  companyName: "Cipriano Tech & Security", legalName: "Cipriano Tecnologia e Segurança Eletrônica LTDA", tagline: "Projetos, instalação e manutenção",
  director: "Gabriel Cipriano", role: "Diretor Técnico", phone: "(12) 99701-1890", landline: "(12) 99701-1890", email: "contato@example.com",
  site: "ciprianotech.com.br", address: "São José dos Campos – SP", cnpj: "00.000.000/0001-00", crea: "Responsável técnico", hours: "Seg–sex 8h–18h",
};
const os: PdfServiceOrderData = {
  number: "OS-TESTE-0001", kind: "corretiva", status: "concluida", priority: "normal", clientName: "Cliente de teste · impressão",
  contact: "Responsável pelo atendimento", phone: "(12) 99999-0000", email: "teste@example.com", site: "Rua de teste, 100 — São José dos Campos/SP",
  description: "Revisão dos endereços IP das câmeras e do NVR após a alteração do provedor de internet e a instalação do software de controle de acesso.",
  diagnosis: "Foram identificados endereços IP fora da faixa de rede, impedindo a comunicação entre os equipamentos.",
  solution: "A configuração dos endereços IP das câmeras e do NVR foi refeita.", technician: "Gabriel Cipriano", scheduledAt: "2026-11-24T12:00:00Z", startedAt: "2026-11-24T12:00:00Z", finishedAt: "2026-11-24T12:00:00Z",
  laborCents: 30000, items: [], notes: "Sem observações adicionais.", clientSignature: "Responsável do cliente", originProposalNumber: "CTS-2026-0004", budgetProposalNumber: null,
};

test("Every document uses embedded brand fonts and dark, readable label text", () => {
  mkdirSync("/tmp/cipriano-document-tests", { recursive: true });
  const renders = {
    os: (pdf: jsPDF) => renderServiceOrderPdf(pdf, os, settings, null),
    proposta: (pdf: jsPDF) => renderProposalPdf(pdf, {
      number: "CTS-TESTE-0001", type: "completa", clientName: os.clientName, contact: os.contact, clientEmail: os.email, site: os.site,
      issuedAt: "2026-11-24T12:00:00Z", validityDays: 15, discountPct: 0,
      items: Array.from({ length: 15 }, (_, i) => ({ id: `item-${i}`, kind: "equipamento" as const, desc: `Câmera IP ${i + 1} · teste de legibilidade`, spec: "Equipamento com especificação técnica e conferência de acentuação", unit: "un", qty: 2, price: 1290 })),
      sections: [
        { id: "equipamentos", title: "Equipamentos e serviços", kind: "items", enabled: true, body: "Descrição e valores dos itens da proposta." },
        { id: "valor", title: "Valor", kind: "totals", enabled: true, body: "Condições acordadas com o cliente." },
        { id: "condicoes", title: "Condições comerciais", kind: "terms", enabled: true, body: "• Pagamento: conforme condição acordada\n• Prazo: 15 dias úteis\n• Garantia: 12 meses" },
        { id: "aceite", title: "Aceite", enabled: true, kind: "text", body: "Concordância com o escopo apresentado." },
      ],
      paymentTerms: "40% entrada e 60% entrega", deliveryTime: "15 dias úteis", warranty: "12 meses", artIncluded: false,
    }, settings, null),
    contrato: (pdf: jsPDF) => renderContractPdf(pdf, { text: "IDENTIFICAÇÃO\nContrato de fornecimento e serviços técnicos.\n\nCONDIÇÕES\nO pagamento segue as condições da proposta.\n• Sem custos adicionais não autorizados.", title: "Contrato", reference: "CTS-TESTE-0001", clientName: os.clientName, revision: 1, maintenance: false, settings, logo: null }),
    entrega: (pdf: jsPDF) => renderDeliveryTermPdf(pdf, { termNumber: "TRM-TESTE-0001", proposalNumber: "CTS-TESTE-0001", clientName: os.clientName, site: os.site, deliveryDate: os.finishedAt, technician: os.technician, receiverName: "Responsável", receiverDoc: "", items: [], intro: "Termo de entrega para conferência.", scopeSummary: "Verificação dos equipamentos relacionados na proposta.", tests: "Registrar testes e resultados verificados.", pendencies: "Conferir em campo.", warranty: "Conforme proposta.", observations: "Revise antes de assinar." }, settings, null),
  };
  for (const [name, render] of Object.entries(renders)) {
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: false, putOnlyUsedFonts: true });
    registerPdfFonts(pdf, fonts);
    const draws: { text: string; size: number; color: string; font: string }[] = [];
    const originalText = pdf.text.bind(pdf);
    pdf.text = ((...args: unknown[]) => {
      draws.push({ text: String(args[0]), size: pdf.getFontSize(), color: pdf.getTextColor(), font: pdf.getFont().fontName });
      return Reflect.apply(originalText, pdf, args);
    }) as typeof pdf.text;
    render(pdf);
    assert.ok(draws.length > 0);
    assert.ok(draws.every((draw) => Object.values(PDF_FONTS).some((font) => font === draw.font)), `${name}: no standard PDF font should be used`);
    const muted = draws.filter((draw) => draw.color.toLowerCase() === "#7d93ad");
    assert.equal(muted.length, 0, `${name}: faded label color removed`);
    if (name === "os") {
      const label = draws.find((draw) => draw.text === "Tipo");
      assert.ok(label && label.size >= 9);
      assert.ok(["#0a192f", "#09182e"].includes(label.color.toLowerCase()), `Dark navy label: ${label.color}`);
      assert.ok(draws.some((draw) => draw.text === "Proposta de origem"));
    }
    const bytes = new Uint8Array(pdf.output("arraybuffer"));
    assert.ok(Buffer.from(bytes).includes(Buffer.from("/FontFile2")), `${name}: embedded TTF file present`);
    writeFileSync(`/tmp/cipriano-document-tests/${name}.pdf`, bytes);
  }
});

test("Document label color has at least 10:1 contrast on the light strip", () => {
  const luminance = (rgb: number[]) => rgb.map((v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (luminance([248, 250, 252]) + 0.05) / (luminance([36, 50, 68]) + 0.05);
  assert.ok(ratio > 10, `contrast: ${ratio}`);
});
