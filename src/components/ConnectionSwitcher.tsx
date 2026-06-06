import { useEffect, useRef, useState } from "react";
import { T } from "../theme";
import { ConnectionConfig, ConnStatus, Env } from "../types";
import { EnvBadge } from "./ui";

export function ConnectionSwitcher({
  conn,
  connections,
  statusOf,
  onSwitch,
  onManage,
}: {
  conn: ConnectionConfig;
  connections: ConnectionConfig[];
  statusOf: (id: string) => ConnStatus;
  onSwitch: (id: string) => void;
  onManage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);

  const m = conn.env;
  const ring = m === "prod" ? "#f3b9b4" : T.line;
  const grouped: [Env, ConnectionConfig[]][] = (["prod", "dev", "test"] as Env[]).map((e) => [
    e,
    connections.filter((c) => c.env === e),
  ]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 9, background: T.card, borderRadius: 22, padding: "6px 8px 6px 6px", boxShadow: T.shadow, border: `1px solid ${ring}`, cursor: "pointer", fontFamily: T.sans }}
      >
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: statusOf(conn.id) === "connected" ? "#2bb86b" : "#cfd0d3", flexShrink: 0, marginLeft: 4 }} />
        <EnvBadge env={conn.env} />
        <span style={{ fontWeight: 600, color: T.text, fontSize: 13, whiteSpace: "nowrap" }}>{conn.name}</span>
        <span style={{ color: T.faint, fontFamily: T.mono, fontSize: 11.5, whiteSpace: "nowrap" }}>{conn.host}</span>
        <span style={{ color: T.faint, fontSize: 10, marginRight: 4 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 8, width: 320, background: T.card, borderRadius: 14, boxShadow: T.shadowLg, border: `1px solid ${T.line}`, padding: 8, zIndex: 500, animation: "obIn .14s ease" }}>
          {grouped.map(([env, conns]) =>
            conns.length === 0 ? null : (
              <div key={env} style={{ marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px 4px" }}>
                  <EnvBadge env={env} />
                  <span style={{ fontSize: 10.5, color: T.faint }}>{conns.length} 个连接</span>
                </div>
                {conns.map((c) => {
                  const active = c.id === conn.id;
                  const connected = statusOf(c.id) === "connected";
                  return (
                    <div
                      key={c.id}
                      onClick={() => { onSwitch(c.id); setOpen(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 9px", borderRadius: 10, cursor: "pointer", background: active ? T.blueSoft : "transparent" }}
                      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = T.canvas; }}
                      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#2bb86b" : "#cfd0d3", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? T.blue : T.text }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: T.faint, fontFamily: T.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{`${c.user} · ${c.host}:${c.port}`}</div>
                      </div>
                      {active ? (
                        <span style={{ color: T.blue, fontWeight: 700 }}>✓</span>
                      ) : !connected ? (
                        <span style={{ fontSize: 11, color: T.dim, border: `1px solid ${T.line}`, borderRadius: 7, padding: "3px 9px" }}>连接</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )
          )}
          <div style={{ height: 1, background: T.lineSoft, margin: "6px 6px" }} />
          <div
            onClick={() => { onManage(); setOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 9px", borderRadius: 10, cursor: "pointer", color: T.dim, fontSize: 12.5 }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = T.canvas)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
          >
            <span style={{ fontSize: 14 }}>＋</span> 新建连接 / 管理连接…
          </div>
        </div>
      )}
    </div>
  );
}
