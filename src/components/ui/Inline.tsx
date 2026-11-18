"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";

/** Campo de uma linha que se confunde com o texto do documento. */
export function InlineText({
  value,
  onChange,
  editable,
  className = "",
  placeholder,
  align,
  style,
}: {
  value: string;
  onChange?: (value: string) => void;
  editable: boolean;
  className?: string;
  placeholder?: string;
  align?: "left" | "right" | "center";
  style?: CSSProperties;
}) {
  if (!editable || !onChange) {
    return <span className={className} style={style}>{value || placeholder || ""}</span>;
  }
  return (
    <input
      className={`cip-inline ${className}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ textAlign: align ?? "inherit", ...style }}
      spellCheck
    />
  );
}

/** Área de texto que cresce com o conteúdo e mantém a tipografia do documento. */
export function InlineArea({
  value,
  onChange,
  editable,
  className = "",
  placeholder,
  children,
}: {
  value: string;
  onChange?: (value: string) => void;
  editable: boolean;
  className?: string;
  placeholder?: string;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, editable]);
  if (!editable || !onChange) {
    return <div className={className}>{children}</div>;
  }
  return (
    <textarea
      ref={ref}
      className={`cip-inline cip-inline-area ${className}`}
      value={value}
      placeholder={placeholder}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      spellCheck
    />
  );
}

/** Número com limites. Aceita digitação livre e confirma o valor limitado ao sair do campo. */
export function InlineNumber({
  value,
  onChange,
  editable,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step,
  className = "",
  align = "inherit",
  suffix,
}: {
  value: number;
  onChange?: (value: number) => void;
  editable: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  align?: "left" | "right" | "center" | "inherit";
  suffix?: string;
}) {
  if (!editable || !onChange) {
    return <span className={className}>{`${value}${suffix ?? ""}`}</span>;
  }
  return (
    <span className="inline-flex items-baseline gap-0.5" style={{ textAlign: align }}>
      <input
        type="number"
        className={`cip-inline cip-inline-num ${className}`}
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        style={{ textAlign: align }}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return;
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        onBlur={(e) => {
          const n = Number(e.target.value);
          const safe = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
          if (safe !== value) onChange(safe);
        }}
      />
      {suffix ? <span className="cip-inline-suffix">{suffix}</span> : null}
    </span>
  );
}
