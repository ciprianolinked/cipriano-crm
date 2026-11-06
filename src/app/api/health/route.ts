import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    await db.execute(sql`select id from app_settings limit 1`);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar o banco";
    const missingTable = /relation .* does not exist|não existe/i.test(message);
    return Response.json(
      {
        ok: false,
        error: missingTable
          ? "Banco conectado, mas as tabelas ainda não existem. Execute o SQL do guia de publicação no Neon."
          : message.slice(0, 400),
      },
      { status: 500 },
    );
  }
}
