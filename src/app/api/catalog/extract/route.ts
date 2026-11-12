import { NextResponse } from "next/server";
import { extractAndParse } from "@/lib/ocr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED = /image\/|application\/pdf|text\/|\.png$|\.jpe?g$|\.webp$|\.bmp$|\.pdf$|\.csv$|\.txt$/i;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envie o arquivo como formulário multipart (campo 'file')." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione um arquivo para analisar." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "O arquivo está vazio." }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Arquivo acima de 8 MB." }, { status: 413 });
  }
  if (!ALLOWED.test(`${file.type} ${file.name}`)) {
    return NextResponse.json({ error: "Formato não suportado. Envie PDF, PNG, JPG, WEBP, BMP, CSV ou TXT." }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { text, items, source } = await extractAndParse(buffer, file.type, file.name);

  if (!items.length) {
    return NextResponse.json({
      ok: false,
      source,
      text: text.slice(0, 2000),
      items: [],
      error: "Não identifiquei itens com preço no anexo. Confira se o arquivo contém preços em R$ e tente novamente, ou adicione os itens manualmente.",
    });
  }

  return NextResponse.json({
    ok: true,
    source,
    text: text.slice(0, 4000),
    items,
    error: null,
  });
}
