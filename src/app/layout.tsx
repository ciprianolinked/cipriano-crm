import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SideNav } from "@/components/nav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Cipriano Tech & Security · Propostas & CRM",
  description:
    "Central comercial da Cipriano Tech & Security: propostas com papel timbrado, geração assistida por IA, PDF em A4 e CRM com kanban e follow-ups.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/logo-cipriano-mark.svg" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="flex min-h-screen flex-col lg:flex-row">
          <SideNav />
          <main className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </main>
        </div>
      </body>
    </html>
  );
}
