"use client";

import { useId, type CSSProperties } from "react";

/**
 * Emblema oficial Cipriano: hexágono duplo, lente/íris e nós ciano.
 * Desenhado para fundos escuros (navy) — usado no timbrado e na navegação.
 */
export function LogoMark({
  height = 40,
  className,
  style,
}: {
  height?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const width = (height * 210) / 240;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const lensId = `cipLens-${uid}`;
  const glassId = `cipGlass-${uid}`;
  const clipId = `cipLensClip-${uid}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 210 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label="Emblema Cipriano Tech & Security"
    >
      <defs>
        <radialGradient id={lensId} cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#1B7C8C" />
          <stop offset="55%" stopColor="#0F4E5C" />
          <stop offset="100%" stopColor="#07222C" />
        </radialGradient>
        <linearGradient id={glassId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clipId}>
          <circle cx="105" cy="118" r="51" />
        </clipPath>
      </defs>

      {/* Hexágono externo */}
      <polygon
        points="105,6 199,54 199,152 105,234 11,152 11,54"
        stroke="#8FA6BE"
        strokeOpacity="0.55"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* Hexágono interno com brilho */}
      <polygon
        points="105,18 188,61 188,146 105,222 22,146 22,61"
        stroke="#E9F1FA"
        strokeWidth="5"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <polygon
        points="105,18 188,61 188,146 105,222 22,146 22,61"
        stroke="#C6D2E0"
        strokeWidth="9"
        strokeLinejoin="round"
        opacity="0.18"
      />

      {/* Anéis tracejados */}
      <circle cx="105" cy="118" r="62" stroke="#00E5FF" strokeOpacity="0.28" strokeWidth="1.2" strokeDasharray="2 7" />
      <circle cx="105" cy="118" r="68" stroke="#00E5FF" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="1 9" />
      <line x1="105" y1="40" x2="105" y2="70" stroke="#00E5FF" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 5" />
      <line x1="105" y1="166" x2="105" y2="196" stroke="#00E5FF" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 5" />
      <line x1="45" y1="118" x2="58" y2="118" stroke="#00E5FF" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 5" />
      <line x1="152" y1="118" x2="165" y2="118" stroke="#00E5FF" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 5" />

      {/* Corpo da lente */}
      <circle cx="105" cy="118" r="51" fill={`url(#${lensId})`} stroke="#F2F7FC" strokeWidth="3.5" />
      <circle cx="105" cy="118" r="45" fill="none" stroke="#00E5FF" strokeOpacity="0.45" strokeWidth="1" />

      {/* Íris / diafragma */}
      <g clipPath={`url(#${clipId})`}>
        <polygon points="105,73 156,118 105,118" fill="#0E5A68" opacity="0.85" />
        <polygon points="156,118 105,163 105,118" fill="#0A4753" opacity="0.9" />
        <polygon points="105,163 54,118 105,118" fill="#0C5260" opacity="0.75" />
        <polygon points="54,118 105,73 105,118" fill="#116878" opacity="0.6" />
        <g stroke="#00E5FF" strokeOpacity="0.55" strokeWidth="1.1">
          <line x1="105" y1="67" x2="105" y2="97" />
          <line x1="149" y1="93" x2="124" y2="108" />
          <line x1="149" y1="143" x2="124" y2="128" />
          <line x1="105" y1="169" x2="105" y2="139" />
          <line x1="61" y1="143" x2="86" y2="128" />
          <line x1="61" y1="93" x2="86" y2="108" />
        </g>
        <circle cx="105" cy="118" r="51" fill="url(#cipGlass)" />
      </g>

      {/* Núcleo hexagonal + ponto da lente */}
      <polygon
        points="105,94 126,106 126,130 105,142 84,130 84,106"
        fill="#04121F"
        stroke="#00E5FF"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="107" cy="118" r="11" fill="#00E5FF" />
      <circle cx="107" cy="118" r="11" fill="#00E5FF" opacity="0.35" />
      <circle cx="95" cy="108" r="4.2" fill="#C6D2E0" />

      {/* Nós de perímetro */}
      {[
        [105, 18],
        [188, 61],
        [188, 146],
        [105, 222],
        [22, 146],
        [22, 61],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r="10" fill="#00E5FF" opacity="0.2" />
          <circle cx={cx} cy={cy} r="6.4" fill="#04121F" stroke="#00E5FF" strokeWidth="3" />
        </g>
      ))}
    </svg>
  );
}

/**
 * Logotipo completo: emblema + divisor + CIPRIANO + TECH & SECURITY.
 * Réplica vetorial da marca fornecida, sem redesenho do desenho original.
 */
export function Logo({
  height = 44,
  className,
  style,
}: {
  height?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const width = (height * 1024) / 256;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 1024 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label="Cipriano Tech & Security"
    >
      <g transform="translate(6,12) scale(0.95)">
        <LogoMarkPaths />
      </g>
      <line x1="252" y1="58" x2="252" y2="198" stroke="#00E5FF" strokeWidth="2.4" opacity="0.85" />
      <text
        x="292"
        y="148"
        fill="#FFFFFF"
        fontFamily="'Space Grotesk','Inter',Arial,sans-serif"
        fontSize="92"
        fontWeight="700"
        letterSpacing="1"
      >
        CIPRIANO
      </text>
      <text
        x="296"
        y="196"
        fill="#00E5FF"
        fontFamily="'IBM Plex Mono',monospace"
        fontSize="26"
        fontWeight="500"
        letterSpacing="12"
      >
        TECH &amp; SECURITY
      </text>
    </svg>
  );
}

/** Mesmo desenho do emblema, em SVG puro (para reuso dentro do lockup). */
function LogoMarkPaths() {
  return (
    <>
      <polygon
        points="105,6 199,54 199,152 105,234 11,152 11,54"
        stroke="#8FA6BE"
        strokeOpacity="0.55"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <polygon
        points="105,18 188,61 188,146 105,222 22,146 22,61"
        stroke="#E9F1FA"
        strokeWidth="5"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <circle cx="105" cy="118" r="62" stroke="#00E5FF" strokeOpacity="0.28" strokeWidth="1.2" strokeDasharray="2 7" />
      <circle cx="105" cy="118" r="51" fill="#0C4450" stroke="#F2F7FC" strokeWidth="3.5" />
      <circle cx="105" cy="118" r="45" fill="none" stroke="#00E5FF" strokeOpacity="0.45" strokeWidth="1" />
      <polygon points="105,73 156,118 105,118" fill="#0E5A68" />
      <polygon points="156,118 105,163 105,118" fill="#0A4753" />
      <polygon points="105,163 54,118 105,118" fill="#0C5260" />
      <polygon points="54,118 105,73 105,118" fill="#116878" />
      <g stroke="#00E5FF" strokeOpacity="0.55" strokeWidth="1.1">
        <line x1="105" y1="67" x2="105" y2="97" />
        <line x1="149" y1="93" x2="124" y2="108" />
        <line x1="149" y1="143" x2="124" y2="128" />
        <line x1="105" y1="169" x2="105" y2="139" />
        <line x1="61" y1="143" x2="86" y2="128" />
        <line x1="61" y1="93" x2="86" y2="108" />
      </g>
      <polygon
        points="105,94 126,106 126,130 105,142 84,130 84,106"
        fill="#04121F"
        stroke="#00E5FF"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="107" cy="118" r="11" fill="#00E5FF" />
      <circle cx="95" cy="108" r="4.2" fill="#C6D2E0" />
      {[
        [105, 18],
        [188, 61],
        [188, 146],
        [105, 222],
        [22, 146],
        [22, 61],
      ].map(([cx, cy]) => (
        <g key={`lock-${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r="10" fill="#00E5FF" opacity="0.2" />
          <circle cx={cx} cy={cy} r="6.4" fill="#04121F" stroke="#00E5FF" strokeWidth="3" />
        </g>
      ))}
    </>
  );
}
