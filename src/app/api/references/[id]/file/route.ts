import { eq } from "drizzle-orm";
import { db } from "@/db";
import { referenceFiles } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureSchema();
  const { id } = await context.params;
  const rows = await db
    .select({
      fileName: referenceFiles.fileName,
      mimeType: referenceFiles.mimeType,
      data: referenceFiles.data,
    })
    .from(referenceFiles)
    .where(eq(referenceFiles.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return new Response("Arquivo não encontrado.", { status: 404 });
  }

  const safeName = row.fileName.replace(/[^\w.\- ()]/g, "_");
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}
