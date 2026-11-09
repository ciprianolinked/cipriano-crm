export const brand = {
  name: "Cipriano Tech & Security",
  legalName: "Cipriano Tecnologia e Segurança Eletrônica LTDA",
  tagline: "Segurança eletrônica IP · Projetos, instalação e monitoramento",
  director: "Gabriel Cipriano",
  role: "Diretor Técnico",
  phone: "+55 (12) 99701-1890",
  phoneHref: "+5512997011890",
  landline: "+55 (12) 99701-1890",
  email: "gabriel.ciprianotech@gmail.com",
  site: "ciprianotech.com.br",
  address: "Alameda Raul Roldão da Costa, 183 - Vila Betania, São José dos Campos - SP, 12245-484",
  cnpj: "69.978.603/0001-69",
  crea: "CREA-SP 5071138295-SP",
  hours: "NOC 24h · Comercial seg–sex 8h–18h",
  colors: {
    navy: "#0A192F",
    abyss: "#050C18",
    signal: "#00E5FF",
    network: "#2F80FF",
    silver: "#C6D2E0",
    steel: "#7D93AD",
    amber: "#FFB020",
    alarm: "#FF3B5C",
    armed: "#35E39A",
    paper: "#FFFFFF",
    ink: "#33465E",
    hairline: "#DCE4EE",
  },
  typography: {
    display: "Space Grotesk",
    body: "IBM Plex Sans",
    mono: "IBM Plex Mono",
  },
  stats: [
    { k: "12", u: "anos", l: "projetando perímetros" },
    { k: "480", u: "+", l: "instalações entregues" },
    { k: "1.240", u: "", l: "câmeras IP em campo" },
    { k: "99,98", u: "%", l: "uptime médio do NOC" },
  ],
  capabilities: [
    "CFTV IP",
    "Controle de acesso",
    "Cerca elétrica",
    "Alarme monitorado",
    "Redes & PoE",
    "Analítico de vídeo",
    "Interfonia IP",
    "Automação de portões",
  ],
} as const;

export const brl = (reais: number) =>
  reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export const fmtDate = (value: Date | string | null | undefined) => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export const fmtDateTime = (value: Date | string | null | undefined) => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export const relativeDays = (value: Date | string | null | undefined) => {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Math.round((d.getTime() - Date.now()) / 86_400_000);
  return diff;
};
