"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** The print mirror avoids browser input clipping and faint form-control rendering on paper. */
export function InlineText({ value, onChange, editable, className = "", placeholder, align, style }: {
  value: string; onChange?: (value: string) => void; editable: boolean; className?: string;
  placeholder?: string; align?: "left" | "right" | "center"; style?: CSSProperties;
}) {
  if (!editable || !onChange) return <span className={className} style={style}>{value || placeholder || ""}</span>;
  return <>
    <input className={`cip-inline cip-edit-control ${className}`} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)} style={{ textAlign: align ?? "inherit", ...style }} spellCheck />
    <span aria-hidden="true" className={`cip-print-value ${className}`} style={{ textAlign: align, ...style }}>{value}</span>
  </>;
}

export function InlineArea({ value, onChange, editable, className = "", placeholder, children }: {
  value: string; onChange?: (value: string) => void; editable: boolean; className?: string;
  placeholder?: string; children?: ReactNode;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    let active = true;
    const resize = () => {
      const el = ref.current;
      if (!active || !el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    resize();
    void document.fonts?.ready.then(resize);
    window.addEventListener("resize", resize);
    return () => { active = false; window.removeEventListener("resize", resize); };
  }, [value, editable]);
  if (!editable || !onChange) return <div className={className}>{children ?? value}</div>;
  return <>
    <textarea ref={ref} className={`cip-inline cip-inline-area cip-edit-control ${className}`} value={value}
      placeholder={placeholder} rows={1} onChange={(e) => onChange(e.target.value)} spellCheck />
    <div aria-hidden="true" className={`cip-print-value cip-print-block ${className}`}>{children ?? value}</div>
  </>;
}

export function InlineNumber({ value, onChange, editable, min = 0, max = Number.MAX_SAFE_INTEGER, step, className = "", align = "inherit", suffix }: {
  value: number; onChange?: (value: number) => void; editable: boolean; min?: number; max?: number;
  step?: number; className?: string; align?: "left" | "right" | "center" | "inherit"; suffix?: string;
}) {
  if (!editable || !onChange) return <span className={className}>{`${value}${suffix ?? ""}`}</span>;
  return <span className="inline-flex items-baseline gap-0.5" style={{ textAlign: align }}>
    <input type="number" className={`cip-inline cip-inline-num cip-edit-control ${className}`}
      value={Number.isFinite(value) ? value : ""} min={min} max={max} step={step} style={{ textAlign: align }}
      onChange={(e) => {
        if (e.target.value === "") return;
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
      }}
      onBlur={(e) => {
        const n = Number(e.target.value);
        const safe = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
        if (safe !== value) onChange(safe);
      }} />
    <span aria-hidden="true" className={`cip-print-value ${className}`}>{value}</span>
    {suffix ? <span className="cip-inline-suffix">{suffix}</span> : null}
  </span>;
}
