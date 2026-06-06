import React from "react";
import { ENV, T } from "../theme";
import { Cell } from "../types";

export async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore — clipboard may be unavailable in some contexts
  }
}

export function fmtVal(v: Cell): string {
  if (v && typeof v === "object" && "__null" in v) return "NULL";
  if (v && typeof v === "object" && "__blob" in v) return `‹blob ${(v.__blob / 1024).toFixed(1)} KB›`;
  return String(v);
}

type BtnKind = "primary" | "default" | "ghost";
export function Btn({
  kind = "default",
  children,
  onClick,
  style,
  title,
  disabled,
}: {
  kind?: BtnKind;
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  title?: string;
  disabled?: boolean;
}) {
  const base: React.CSSProperties = {
    borderRadius: 10, fontSize: 12.5, cursor: disabled ? "default" : "pointer", fontWeight: 600,
    whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6,
    transition: "background .12s", opacity: disabled ? 0.5 : 1,
  };
  const variants: Record<BtnKind, React.CSSProperties> = {
    primary: { background: T.blue, border: "none", padding: "7px 15px", color: "#fff" },
    default: { background: T.card, border: `1px solid ${T.line}`, padding: "6px 13px", color: T.text },
    ghost: { background: "none", border: "none", padding: "6px 11px", color: T.dim, fontWeight: 500 },
  };
  return (
    <button title={title} disabled={disabled} onClick={onClick} style={{ ...base, ...variants[kind], ...style }}>
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ({ v: T; label: string } | T)[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", background: T.canvas, borderRadius: 9, padding: 2 }}>
      {options.map((o) => {
        const v = (typeof o === "object" ? o.v : o) as T;
        const label = typeof o === "object" ? o.label : o;
        const on = v === value;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            style={{
              border: "none", borderRadius: 7, padding: "4px 11px", fontSize: 11.5, cursor: "pointer",
              fontWeight: 600, fontVariantNumeric: "tabular-nums",
              background: on ? T.card : "transparent", color: on ? T.text : T.faint,
              boxShadow: on ? "0 1px 2px rgba(0,0,0,.08)" : "none",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function EnvBadge({ env, size }: { env: string; size?: "sm" }) {
  const m = ENV[env];
  if (!m) return null;
  return (
    <span
      style={{
        fontSize: size === "sm" ? 10 : 11, fontWeight: 700, color: m.color, background: m.soft,
        padding: size === "sm" ? "1px 6px" : "2px 8px", borderRadius: 6, whiteSpace: "nowrap", letterSpacing: ".02em",
      }}
    >
      {m.label}
    </span>
  );
}

export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div
      style={{
        position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", zIndex: 1100,
        background: "#23262e", color: "#fff", padding: "10px 18px", borderRadius: 11, fontSize: 13,
        fontWeight: 500, boxShadow: "0 8px 30px rgba(0,0,0,.25)", animation: "obIn .16s ease",
        display: "flex", alignItems: "center", gap: 9,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2bb86b" }} />
      {msg}
    </div>
  );
}
