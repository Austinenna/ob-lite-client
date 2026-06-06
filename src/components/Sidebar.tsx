import React, { useEffect, useMemo, useState } from "react";
import { T } from "../theme";
import { ConnectionConfig } from "../types";
import { metaStore, useMeta } from "../store";

function hi(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: "#fff2b0", color: "inherit", padding: 0, borderRadius: 2 }}>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function Sidebar({
  conn,
  filter,
  onFilter,
  onOpenTable,
  activeKey,
}: {
  conn: ConnectionConfig;
  filter: string;
  onFilter: (f: string) => void;
  onOpenTable: (db: string, table: string) => void;
  activeKey: string | null;
}) {
  const m = useMeta(conn.id);
  const primary = conn.primary || conn.database || "";
  const [open, setOpen] = useState<Record<string, boolean>>(() => (primary ? { [primary]: true } : {}));

  // load databases when connection changes; auto-expand primary
  useEffect(() => {
    void metaStore.ensureDatabases(conn.id);
    setOpen(primary ? { [primary]: true } : {});
    if (primary) void metaStore.ensureTables(conn.id, primary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn.id]);

  const dbs = m.databases || [];
  const q = filter.trim();

  const matchCount = useMemo(() => {
    if (!q) return null;
    let n = 0;
    dbs.forEach((db) => (m.tables[db] || []).forEach((t) => { if (t.name.toLowerCase().includes(q.toLowerCase())) n++; }));
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, dbs, m]);

  const toggle = (db: string) => {
    setOpen((o) => ({ ...o, [db]: !o[db] }));
    void metaStore.ensureTables(conn.id, db);
  };

  // when filtering, make sure tables for all dbs are loaded so matches can show
  useEffect(() => {
    if (q) dbs.forEach((db) => void metaStore.ensureTables(conn.id, db));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div style={{ width: 248, background: T.card, borderRadius: 16, boxShadow: T.shadow, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
      {/* filter */}
      <div style={{ padding: 12, borderBottom: `1px solid ${T.lineSoft}` }}>
        <div style={{ background: T.canvas, borderRadius: 11, padding: "8px 11px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: T.faint, fontSize: 13 }}>⌕</span>
          <input
            value={filter}
            onChange={(e) => onFilter(e.target.value)}
            placeholder="筛选表名…"
            style={{ border: "none", outline: "none", background: "none", flex: 1, fontSize: 12.5, color: T.text, fontFamily: T.sans, minWidth: 0 }}
          />
          {filter && (
            <span onClick={() => onFilter("")} style={{ color: T.faint, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</span>
          )}
        </div>
        {q && <div style={{ fontSize: 11, color: T.faint, marginTop: 7, paddingLeft: 2 }}>匹配 {matchCount} 张表</div>}
      </div>

      {/* tree */}
      <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
        {dbs.length === 0 && <div style={{ padding: 20, textAlign: "center", color: T.faint, fontSize: 12.5 }}>加载数据库…</div>}
        {dbs.map((db) => {
          const tables = m.tables[db] || [];
          const filtered = q ? tables.filter((t) => t.name.toLowerCase().includes(q.toLowerCase())) : tables;
          const isOpen = q ? filtered.length > 0 : !!open[db];
          if (q && filtered.length === 0) return null;
          const isPrimary = db === primary;
          return (
            <div key={db} style={{ marginBottom: 2 }}>
              <div
                onClick={() => !q && toggle(db)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, cursor: q ? "default" : "pointer", fontWeight: isPrimary ? 600 : 500, color: isPrimary ? T.text : T.dim }}
              >
                <span style={{ width: 10, fontSize: 9, color: T.faint }}>{isOpen ? "▾" : "▸"}</span>
                <span style={{ width: 16, height: 16, borderRadius: 5, background: isPrimary ? T.blue : "#d7d8da", flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{db}</span>
                {isPrimary && <span style={{ fontSize: 9.5, color: T.faint, marginLeft: "auto" }}>默认</span>}
              </div>
              {isOpen &&
                (filtered.length ? (
                  filtered.map((t) => {
                    const key = `${conn.id}/${db}/${t.name}`;
                    const active = key === activeKey;
                    return (
                      <div
                        key={t.name}
                        onClick={() => onOpenTable(db, t.name)}
                        title={t.name}
                        style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 10px 6px 32px", borderRadius: 10, marginBottom: 1, cursor: "pointer", background: active ? T.blueSoft : "transparent", color: active ? T.blue : T.dim, fontWeight: active ? 600 : 400, fontSize: 12.5 }}
                      >
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: t.type === "view" ? "#cdb6ef" : active ? T.blue : "#cfd0d3", flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hi(t.name, q)}</span>
                        {t.type === "view" && <span style={{ fontSize: 9, color: T.faint, marginLeft: "auto" }}>视图</span>}
                      </div>
                    );
                  })
                ) : !q ? (
                  <div style={{ padding: "4px 10px 6px 32px", fontSize: 11.5, color: T.faint }}>（展开以加载）</div>
                ) : null)}
            </div>
          );
        })}
        {q && matchCount === 0 && <div style={{ padding: 20, textAlign: "center", color: T.faint, fontSize: 12.5 }}>没有匹配 “{q}” 的表</div>}
      </div>
    </div>
  );
}
