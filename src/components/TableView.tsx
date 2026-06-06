import React, { useEffect, useState } from "react";
import { api } from "../api";
import { T } from "../theme";
import { metaStore } from "../store";
import { ColumnMeta, ConnectionConfig, QueryResult, TableTab, isAppError } from "../types";
import { DataGrid, ViewCell } from "./DataGrid";
import { Btn, copy, Segmented } from "./ui";

export function TableView({
  conn,
  tab,
  onUpdateTab,
  onToast,
  onViewCell,
}: {
  conn: ConnectionConfig;
  tab: TableTab;
  onUpdateTab: (patch: Partial<TableTab>) => void;
  onToast: (m: string) => void;
  onViewCell: (c: ViewCell) => void;
}) {
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [whereInput, setWhereInput] = useState(tab.where || "");

  const pageSize = tab.pageSize || 50;
  const page = tab.page || 1;
  const sub = tab.sub || "data";

  // load schema once
  useEffect(() => {
    metaStore.ensureColumns(conn.id, tab.db, tab.table).then(setColumns).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn.id, tab.db, tab.table]);

  // load data on page / size / where changes
  useEffect(() => {
    if (sub !== "data") return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    api
      .queryTable({ id: conn.id, db: tab.db, table: tab.table, page, pageSize, whereClause: tab.where || undefined })
      .then((r) => { if (!cancelled) setResult(r); })
      .catch((e) => { if (!cancelled) setErr(isAppError(e) ? `${e.zh} (${e.msg})` : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn.id, tab.db, tab.table, page, pageSize, tab.where, sub]);

  const cols = (result?.columns || columns).map((c) => c.name);
  const pkCols = new Set((result?.columns || columns).filter((c) => c.key === "PRI").map((c) => c.name));
  const rows = result?.rows || [];

  const applyFilter = () => onUpdateTab({ where: whereInput.trim(), page: 1 });

  return (
    <div style={{ flex: 1, background: T.card, borderRadius: 16, boxShadow: T.shadow, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${T.lineSoft}`, flexShrink: 0 }}>
        <Segmented options={[{ v: "data", label: "数据" }, { v: "struct", label: "结构" }]} value={sub} onChange={(v) => onUpdateTab({ sub: v as "data" | "struct" })} />
        <span style={{ fontFamily: T.mono, fontSize: 12.5, color: T.text, fontWeight: 600 }}>{tab.table}</span>
        {sub === "data" && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.dim, fontSize: 12, whiteSpace: "nowrap" }}>
            <span style={{ color: T.faint }}>·</span>
            {loading ? "加载中…" : `${rows.length} 行`}
            {result && <span style={{ color: T.faint }}>· {result.durationMs}ms</span>}
            <CountLink conn={conn} tab={tab} onToast={onToast} />
          </span>
        )}
        <div style={{ flex: 1 }} />
        {sub === "data" && (
          <>
            <span style={{ fontSize: 11.5, color: T.faint }}>每页</span>
            <Segmented options={["20", "50", "100", "200"]} value={String(pageSize)} onChange={(v) => onUpdateTab({ pageSize: +v, page: 1 })} />
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
              <PageBtn onClick={() => onUpdateTab({ page: Math.max(1, page - 1) })}>‹</PageBtn>
              <span style={{ fontSize: 12, color: T.dim, fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "center" }}>第 {page} 页</span>
              <PageBtn onClick={() => onUpdateTab({ page: page + 1 })}>›</PageBtn>
            </div>
            <Btn kind="ghost" onClick={() => onUpdateTab({ page })}>↻</Btn>
          </>
        )}
      </div>

      {/* filter bar */}
      {sub === "data" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: `1px solid ${T.lineSoft}`, flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, color: T.faint, fontWeight: 700 }}>WHERE</span>
          <input
            value={whereInput}
            onChange={(e) => setWhereInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyFilter(); }}
            placeholder="如：status = 'PAID' AND amount > 100（留空查看全部）"
            style={{ flex: 1, border: `1px solid ${T.line}`, borderRadius: 9, padding: "6px 11px", fontSize: 12.5, fontFamily: T.mono, color: T.text, outline: "none", background: T.card }}
          />
          {tab.where && <Btn kind="ghost" onClick={() => { setWhereInput(""); onUpdateTab({ where: "", page: 1 }); }}>清除</Btn>}
          <Btn kind="default" onClick={applyFilter}>筛选</Btn>
        </div>
      )}

      {/* body */}
      {sub === "data" ? (
        err ? (
          <div style={{ padding: 18 }}>
            <div style={{ border: "1px solid #f3c3b6", background: "#fdf4f2", borderRadius: 12, padding: 16, fontSize: 13, color: "#a73c22", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{err}</div>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: "hidden" }}>
            <DataGrid columns={cols} rows={rows} pkCols={pkCols} onToast={onToast} onViewCell={onViewCell} rowOffset={(page - 1) * pageSize} />
          </div>
        )
      ) : (
        <StructureView conn={conn} tab={tab} schema={columns} onToast={onToast} />
      )}
    </div>
  );
}

function CountLink({ conn, tab, onToast }: { conn: ConnectionConfig; tab: TableTab; onToast: (m: string) => void }) {
  return (
    <span
      onClick={async () => {
        try {
          const n = await api.countTable(conn.id, tab.db, tab.table, tab.where || undefined);
          onToast(`COUNT(*) = ${n.toLocaleString()} 行`);
        } catch (e) {
          onToast(isAppError(e) ? e.zh : "统计失败");
        }
      }}
      style={{ color: T.blue, cursor: "pointer", fontSize: 11.5, marginLeft: 2 }}
    >
      统计行数
    </span>
  );
}

function PageBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${T.line}`, background: T.card, color: T.dim, cursor: "pointer", fontSize: 13 }}>
      {children}
    </button>
  );
}

function StructureView({
  conn,
  tab,
  schema,
  onToast,
}: {
  conn: ConnectionConfig;
  tab: TableTab;
  schema: ColumnMeta[];
  onToast: (m: string) => void;
}) {
  const [ddl, setDdl] = useState("");
  useEffect(() => {
    api.getCreateTable(conn.id, tab.db, tab.table).then(setDdl).catch(() => setDdl(""));
  }, [conn.id, tab.db, tab.table]);

  const head = ["字段", "类型", "可空", "默认值", "键", "附加"];
  const widths = [220, 180, 70, 180, 80, 140];

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ display: "flex", background: "#fcfcfb", borderBottom: `1px solid ${T.line}`, fontSize: 11.5, fontWeight: 600, color: T.dim }}>
          {head.map((h, i) => (
            <div key={i} style={{ width: widths[i], padding: "8px 12px" }}>{h}</div>
          ))}
        </div>
        {schema.map((c, i) => (
          <div key={c.name} style={{ display: "flex", borderBottom: i < schema.length - 1 ? `1px solid ${T.lineSoft}` : "none", fontSize: 12.5, fontFamily: T.mono }}>
            <div style={{ width: widths[0], padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
              {c.name}
              {c.key === "PRI" && <span style={{ fontSize: 8.5, fontWeight: 700, color: T.blue, background: T.blueSoft, padding: "1px 5px", borderRadius: 8, fontFamily: T.sans }}>PK</span>}
              {c.key === "UNI" && <span style={{ fontSize: 8.5, fontWeight: 700, color: "#8b6fce", background: "#f2ecfb", padding: "1px 5px", borderRadius: 8, fontFamily: T.sans }}>UNI</span>}
            </div>
            <div style={{ width: widths[1], padding: "8px 12px", color: T.dim }}>{c.type}</div>
            <div style={{ width: widths[2], padding: "8px 12px", color: c.nullable ? T.dim : T.faint }}>{c.nullable ? "YES" : "NO"}</div>
            <div style={{ width: widths[3], padding: "8px 12px", color: c.def == null ? T.faint : T.text }}>{c.def == null ? "NULL" : c.def}</div>
            <div style={{ width: widths[4], padding: "8px 12px", color: T.dim }}>{c.key || "—"}</div>
            <div style={{ width: widths[5], padding: "8px 12px", color: T.dim }}>{c.extra || "—"}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.faint, letterSpacing: ".04em" }}>建表语句</span>
        <Btn kind="default" onClick={() => { void copy(ddl); onToast("已复制建表语句"); }}>复制 DDL</Btn>
      </div>
      <pre style={{ margin: 0, background: "#fbfbfa", border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, fontFamily: T.mono, fontSize: 12.5, lineHeight: 1.6, color: T.text, overflow: "auto", whiteSpace: "pre" }}>
        {ddl || "加载中…"}
      </pre>
    </div>
  );
}
