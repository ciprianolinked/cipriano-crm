import { GERENCIAL_FAVICON_ICO } from "@/lib/brand-assets";

export const runtime = "nodejs";

export function GET() {
  return new Response(Uint8Array.from(Buffer.from(GERENCIAL_FAVICON_ICO, "base64")), {
    headers: {
      "Content-Type": "image/x-icon",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
