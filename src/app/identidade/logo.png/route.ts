import { GERENCIAL_LOGO_PNG } from "@/lib/brand-assets";

export const runtime = "nodejs";

export function GET() {
  return new Response(Uint8Array.from(Buffer.from(GERENCIAL_LOGO_PNG, "base64")), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
