import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ settings: await getSettings() });
}

export async function PATCH(request: Request) {
  const current = await getSettings();
  const body = (await request.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  const textFields = [
    "companyName",
    "legalName",
    "tagline",
    "director",
    "role",
    "phone",
    "landline",
    "email",
    "site",
    "address",
    "cnpj",
    "crea",
    "hours",
    "defaultPaymentTerms",
    "defaultDeliveryTime",
    "defaultWarranty",
  ];
  for (const field of textFields) if (field in body) patch[field] = String(body[field] ?? "");
  if ("defaultValidityDays" in body)
    patch.defaultValidityDays = Math.max(1, Math.round(Number(body.defaultValidityDays ?? 15)));

  const [row] = await db.update(appSettings).set(patch).where(eq(appSettings.id, current.id)).returning();
  return NextResponse.json({ settings: row });
}
