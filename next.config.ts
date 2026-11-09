import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O pdfkit é tratado como pacote externo e os arquivos de métricas das fontes
  // padrão (AFM) precisam acompanhar a função na publicação.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/quotations/[id]/pdf": ["./node_modules/pdfkit/js/data/*.afm"],
    "/api/indicadores/pdf": ["./node_modules/pdfkit/js/data/*.afm"],
  },
};

export default nextConfig;
