// Identidade Gerencial — usa o arquivo OFICIAL do logo, sem redesenho.
// O logo tem texto branco: deve ser exibido sempre sobre o azul-marinho
// institucional (#181447). Por isso este componente renderiza o logo dentro
// de uma placa azul-marinho quando usado sobre fundos claros.

type BrandLogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  // Quando true, mostra o símbolo isolado (favicon oficial) em vez do logo horizontal.
  markOnly?: boolean;
  // "plate" (padrão): placa azul-marinho para fundos claros.
  // "bare": apenas a imagem, para uso sobre fundos já escuros (cabeçalho, documento).
  treatment?: "plate" | "bare";
  className?: string;
};

// Rotas servidas pelo aplicativo com os arquivos originais incorporados.
// O parâmetro renova eventuais imagens antigas no cache do navegador.
const LOGO_URL = "/identidade/logo.png?v=20261027";
const MARK_URL = "/identidade/simbolo.png?v=20261027";

const HEIGHTS: Record<NonNullable<BrandLogoProps["size"]>, number> = {
  sm: 26,
  md: 34,
  lg: 46,
  xl: 62,
};

const MARK_SIZES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-11 w-11",
  xl: "h-14 w-14",
};

export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={MARK_URL} alt="Símbolo Gerencial" className={`${className} rounded-md object-cover`} />
  );
}

export function BrandLogo({ size = "md", markOnly = false, treatment = "plate", className = "" }: BrandLogoProps) {
  if (markOnly) {
    return <BrandMark className={`${MARK_SIZES[size]} ${className}`} />;
  }

  const height = HEIGHTS[size];

  if (treatment === "bare") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={LOGO_URL}
        alt="Gerencial — Governança Condominial"
        style={{ height }}
        className={`w-auto max-w-full ${className}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-lg bg-ink px-3 py-1.5 shadow-sm ${className}`}
      role="img"
      aria-label="Gerencial — Governança Condominial"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_URL} alt="" style={{ height }} className="w-auto max-w-full" aria-hidden="true" />
    </span>
  );
}
