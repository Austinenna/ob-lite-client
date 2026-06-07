import React, { useRef, useState } from "react";
import { api, uid } from "../api";
import { splitSql } from "../sql";
import { T } from "../theme";
import { AppError, ConnectionConfig, QueryTab, StatementResult, isAppError } from "../types";
import { DataGrid, ViewCell } from "./DataGrid";
import { SqlEditor, SqlEditorHandle } from "./SqlEditor";
import { Btn, copy, Segmented } from "./ui";

const DEFAULT_PAGE_SIZE = 50;

function normalizeErr(e: unknown): AppError {
  return isAppError(e) ? e : { code: "ERR", msg: String(e), zh: "执行失败" };
}

export function QueryView({
  conn,
  tab,
  onUpdateTab,
  onToast,
  onViewCell,
  onAfterExec,
}: {
  conn: ConnectionConfig;
  tab: QueryTab;
  onUpdateTab: (patch: Partial<QueryTab>) => void;
  onToast: (m: string) => void;
  onViewCell: (c: ViewCell) => void;
  onAfterExec: () => void;
}) {
  const editorRef = useRef<SqlEditorHandle>(null);
  const cancelledRef = useRef(false); // set true to abort the running batch
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pageSizePref, setPageSizePref] = useState(DEFAULT_PAGE_SIZE);

  const status = tab.status || "idle";
  const layout = tab.layout || "v";
  const editorH = tab.editorH || 180;
  const editorPct = tab.editorPct || 48;
  const db = conn.database || conn.primary || undefined;
  const results = tab.results || [];
  const activeIdx = Math.min(tab.activeResult ?? 0, Math.max(0, results.length - 1));
  const active = results[activeIdx];

  // Execute the whole script: split into statements, run each in order, each
  // producing its own result tab. Paging is server-side per statement.
  const runFresh = async (text?: string) => {
    const statements = splitSql(text ?? tab.sql);
    if (statements.length === 0) {
      onToast("没有可执行的语句");
      return;
    }
    cancelledRef.current = false;
    const acc: StatementResult[] = statements.map((s) => ({ sql: s, status: "pending", page: 1, pageSize: pageSizePref }));
    onUpdateTab({ status: "running", results: [...acc], activeResult: 0 });

    for (let i = 0; i < statements.length; i++) {
      if (cancelledRef.current) {
        acc[i] = { ...acc[i], status: "cancelled" };
        continue;
      }
      const qid = uid("q_");
      acc[i] = { ...acc[i], status: "running" };
      onUpdateTab({ results: [...acc], activeResult: i, queryId: qid });
      try {
        const r = await api.executeSql({ id: conn.id, sql: statements[i], queryId: qid, database: db, page: 1, pageSize: pageSizePref });
        acc[i] = cancelledRef.current
          ? { ...acc[i], status: "cancelled" }
          : { ...acc[i], status: r.kind === "rows" ? "rows" : "affected", result: r };
      } catch (e) {
        if (cancelledRef.current) acc[i] = { ...acc[i], status: "cancelled" };
        else if (isAppError(e) && e.code === "TIMEOUT") acc[i] = { ...acc[i], status: "timeout", error: e };
        else acc[i] = { ...acc[i], status: "error", error: normalizeErr(e) };
      }
      onUpdateTab({ results: [...acc] });
    }
    onUpdateTab({ status: "done", queryId: undefined });
    onAfterExec();
  };

  // Re-fetch one statement's result at a different page / page size.
  const fetchPage = async (idx: number, page: number, size: number) => {
    const sr = (tab.results || [])[idx];
    if (!sr) return;
    const qid = uid("q_");
    try {
      const r = await api.executeSql({ id: conn.id, sql: sr.sql, queryId: qid, database: db, page, pageSize: size });
      onUpdateTab({ results: (tab.results || []).map((x, j) => (j === idx ? { ...x, status: r.kind === "rows" ? "rows" : "affected", result: r, page, pageSize: size } : x)) });
    } catch (e) {
      onUpdateTab({ results: (tab.results || []).map((x, j) => (j === idx ? { ...x, status: "error", error: normalizeErr(e), page, pageSize: size } : x)) });
    }
  };

  // Honest cancel: show "cancelling…", KILL on the server, abort the batch.
  const cancel = () => {
    if (status !== "running") return;
    cancelledRef.current = true;
    const qid = tab.queryId;
    onUpdateTab({ status: "cancelling" });
    if (qid) void api.cancelQuery(qid).catch(() => {});
  };

  const clearAll = () => onUpdateTab({ sql: "", status: "idle", results: undefined, activeResult: undefined });

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      if (layout === "v") {
        let h = ev.clientY - rect.top;
        h = Math.max(96, Math.min(rect.height - 130, h));
        onUpdateTab({ editorH: h });
      } else {
        let p = ((ev.clientX - rect.left) / rect.width) * 100;
        p = Math.max(24, Math.min(76, p));
        onUpdateTab({ editorPct: p });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.cursor = layout === "v" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
  };

  const card: React.CSSProperties = { background: T.card, borderRadius: 16, boxShadow: T.shadow };

  const runBtn =
    status === "running" ? (
      <Btn kind="default" onClick={cancel} style={{ color: "#cf5a3a", borderColor: "#f3c3b6" }}>■ 取消</Btn>
    ) : status === "cancelling" ? (
      <Btn kind="default" disabled style={{ color: "#cf5a3a", borderColor: "#f3c3b6" }}>取消中…</Btn>
    ) : (
      <Btn kind="primary" onClick={() => runFresh(editorRef.current?.runText())}>
        ▶ 执行<span style={{ opacity: 0.6, marginLeft: 2, fontSize: 11 }}>⌘↵</span>
      </Btn>
    );

  const editorHeader = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: `1px solid ${T.lineSoft}`, flexShrink: 0, overflow: "hidden" }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".04em", color: T.faint }}>SQL</span>
      <Segmented options={[{ v: "v", label: "上下" }, { v: "h", label: "并排" }]} value={layout} onChange={(v) => onUpdateTab({ layout: v as "v" | "h" })} />
      <div style={{ flex: 1, minWidth: 8 }} />
      <span style={{ fontSize: 11, color: T.faint, fontFamily: T.mono, whiteSpace: "nowrap" }}>分号分隔多条 · ⌘↵ 执行 · esc 取消</span>
      <Btn kind="ghost" onClick={clearAll}>清空</Btn>
      <Btn kind="default" onClick={() => runFresh(editorRef.current?.runText())}>执行选中</Btn>
      {runBtn}
    </div>
  );

  const editorCard = (
    <div style={{ ...card, display: "flex", flexDirection: "column", overflow: "hidden", ...(layout === "v" ? { height: editorH, flexShrink: 0 } : { width: `${editorPct}%`, flexShrink: 0 }) }}>
      {editorHeader}
      <div style={{ flex: 1, minHeight: 0 }}>
        <SqlEditor ref={editorRef} value={tab.sql} onChange={(v) => onUpdateTab({ sql: v })} onRun={(t) => runFresh(t)} onCancel={cancel} running={status === "running"} />
      </div>
    </div>
  );

  // pagination for the active result (only when it is a row set)
  const showPager = active?.status === "rows" && !!active.result;
  const hasMore = !!active?.result?.hasMore;

  const resultsHeader = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${T.lineSoft}`, flexShrink: 0, overflow: "hidden" }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".04em", color: T.faint }}>查询结果</span>
      <OverallChip status={status} results={results} />
      <div style={{ flex: 1, minWidth: 8 }} />
      {showPager && active && (
        <>
          <span style={{ fontSize: 11.5, color: T.faint }}>每页</span>
          <Segmented options={["20", "50", "100", "200"]} value={String(active.pageSize)} onChange={(v) => { setPageSizePref(+v); fetchPage(activeIdx, 1, +v); }} />
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
            <SmallBtn onClick={() => fetchPage(activeIdx, active.page - 1, active.pageSize)} disabled={active.page <= 1}>‹</SmallBtn>
            <span style={{ fontSize: 12, color: T.dim, fontVariantNumeric: "tabular-nums", minWidth: 44, textAlign: "center" }}>第 {active.page} 页</span>
            <SmallBtn onClick={() => fetchPage(activeIdx, active.page + 1, active.pageSize)} disabled={!hasMore}>›</SmallBtn>
          </div>
          <Btn kind="ghost" onClick={() => { const rows = active.result!.rows || []; void copy(rows.map((r) => r.map((c) => (typeof c === "string" ? c : "")).join("\t")).join("\n")); onToast(`已复制本页（${rows.length} 行）`); }}>复制本页</Btn>
        </>
      )}
    </div>
  );

  const resultsCard = (
    <div style={{ ...card, flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {resultsHeader}
      {results.length > 1 && (
        <ResultTabs results={results} active={activeIdx} onSelect={(i) => onUpdateTab({ activeResult: i })} />
      )}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <ActiveResult status={status} sr={active} onToast={onToast} onViewCell={onViewCell} onRun={() => runFresh()} />
      </div>
    </div>
  );

  const divider = (
    <div
      onPointerDown={startDrag}
      onDoubleClick={() => onUpdateTab({ editorH: 180, editorPct: 48 })}
      className="ob-split"
      style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", ...(layout === "v" ? { height: 14, width: "100%", cursor: "row-resize" } : { width: 14, height: "100%", cursor: "col-resize" }) }}
    >
      <div className="ob-split-grip" style={layout === "v" ? { width: 38, height: 4, borderRadius: 3, background: T.line } : { width: 4, height: 38, borderRadius: 3, background: T.line }} />
    </div>
  );

  return (
    <div ref={wrapRef} style={{ flex: 1, display: "flex", flexDirection: layout === "v" ? "column" : "row", minHeight: 0, minWidth: 0 }}>
      {editorCard}
      {divider}
      {resultsCard}
    </div>
  );
}

function statusDot(s: StatementResult["status"]): string {
  switch (s) {
    case "rows":
    case "affected":
      return "#2bb86b";
    case "error":
    case "timeout":
      return "#cf5a3a";
    case "cancelled":
      return "#b5851a";
    case "running":
      return "#2f6bdd";
    default:
      return "#cfd0d3";
  }
}

function briefOf(sr: StatementResult): string {
  switch (sr.status) {
    case "rows":
      return `${sr.result?.rowCount ?? 0} 行`;
    case "affected":
      return `影响 ${sr.result?.affected ?? 0}`;
    case "error":
      return "失败";
    case "timeout":
      return "超时";
    case "cancelled":
      return "已取消";
    case "running":
      return "执行中";
    default:
      return "等待";
  }
}

function ResultTabs({ results, active, onSelect }: { results: StatementResult[]; active: number; onSelect: (i: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: `1px solid ${T.lineSoft}`, overflowX: "auto", flexShrink: 0 }}>
      {results.map((sr, i) => {
        const on = i === active;
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            title={sr.sql}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 9, border: `1px solid ${on ? T.blue : T.line}`, background: on ? T.blueSoft : T.card, color: on ? T.blue : T.dim, cursor: "pointer", fontSize: 12, fontWeight: on ? 600 : 500, whiteSpace: "nowrap", flexShrink: 0 }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusDot(sr.status) }} />
            语句 {i + 1}
            <span style={{ color: on ? T.blue : T.faint, fontSize: 11 }}>· {briefOf(sr)}</span>
          </button>
        );
      })}
    </div>
  );
}

function OverallChip({ status, results }: { status: QueryTab["status"]; results: StatementResult[] }) {
  const wrap = (children: React.ReactNode, color = T.dim) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color }}>{children}</span>
  );
  const spin = (c1: string, c2: string) => <span className="ob-spin" style={{ width: 11, height: 11, border: `2px solid ${c1}`, borderTopColor: c2, borderRadius: "50%", display: "inline-block" }} />;
  if (status === "idle") return wrap(<><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#cfd0d3" }} />未执行</>);
  if (status === "running") return wrap(<>{spin(T.blueSoft, T.blue)}执行中…</>);
  if (status === "cancelling") return wrap(<>{spin("#f3c3b6", "#cf5a3a")}<span style={{ color: "#cf5a3a" }}>正在取消…</span></>, "#cf5a3a");
  // done
  if (results.length === 1) {
    const sr = results[0];
    const ms = sr.result?.durationMs;
    if (sr.status === "rows") return wrap(<><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2bb86b" }} /><b style={{ color: T.text, fontVariantNumeric: "tabular-nums" }}>{sr.result?.rowCount}</b> 行 · {ms} ms</>);
    if (sr.status === "affected") return wrap(<><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2bb86b" }} />执行成功 · 影响 <b style={{ color: T.text }}>{sr.result?.affected}</b> 行 · {ms} ms</>);
    if (sr.status === "error" || sr.status === "timeout") return wrap(<><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#cf5a3a" }} /><span style={{ color: "#cf5a3a", fontWeight: 600 }}>{sr.status === "timeout" ? "查询超时" : "执行失败"}</span></>);
    if (sr.status === "cancelled") return wrap(<><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#b5851a" }} />已取消</>);
  }
  const ok = results.filter((r) => r.status === "rows" || r.status === "affected").length;
  const bad = results.filter((r) => r.status === "error" || r.status === "timeout").length;
  return wrap(<><span style={{ width: 7, height: 7, borderRadius: "50%", background: bad ? "#cf5a3a" : "#2bb86b" }} />{results.length} 条语句 · 成功 {ok}{bad ? ` · 失败 ${bad}` : ""}</>);
}

function ActiveResult({
  status,
  sr,
  onToast,
  onViewCell,
  onRun,
}: {
  status: QueryTab["status"];
  sr: StatementResult | undefined;
  onToast: (m: string) => void;
  onViewCell: (c: ViewCell) => void;
  onRun: () => void;
}) {
  const empty = (icon: string, title: string, desc?: string, extra?: React.ReactNode) => (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: T.faint, padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 26 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.dim }}>{title}</div>
      {desc && <div style={{ fontSize: 12.5, maxWidth: 420, lineHeight: 1.6 }}>{desc}</div>}
      {extra}
    </div>
  );

  if (status === "cancelling")
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#cf5a3a" }}>
        <span className="ob-spin" style={{ width: 16, height: 16, border: "2.5px solid #f3c3b6", borderTopColor: "#cf5a3a", borderRadius: "50%" }} />
        正在取消查询，等待数据库确认停止…
      </div>
    );
  if (!sr) return empty("⌘↵", "尚未执行查询", "在上方输入 SQL（可用分号分隔多条），按 ⌘↵ 执行。");

  if (sr.status === "pending") return empty("…", "等待执行", "前序语句执行完后将执行此语句。");
  if (sr.status === "running")
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: T.dim }}>
        <span className="ob-spin" style={{ width: 16, height: 16, border: `2.5px solid ${T.blueSoft}`, borderTopColor: T.blue, borderRadius: "50%" }} />
        正在执行，可按 esc 取消…
      </div>
    );
  if (sr.status === "cancelled") return empty("⊘", "查询已取消", "该语句已被取消。", <Btn kind="default" onClick={onRun} style={{ marginTop: 6 }}>重新执行</Btn>);
  if (sr.status === "affected") return empty("✓", "执行成功", `语句执行完成，影响 ${sr.result?.affected ?? 0} 行，耗时 ${sr.result?.durationMs ?? 0} ms。无结果集返回。`);
  if (sr.status === "error" || sr.status === "timeout") {
    const e = sr.error;
    return <ErrorPanel code={e?.code || "ERR"} msg={e?.msg || ""} zh={e?.zh || "执行失败"} onToast={onToast} />;
  }
  // rows
  const r = sr.result;
  if (!r || !r.rows || r.rows.length === 0) return empty("∅", "执行成功，无结果", "查询正常执行，但没有返回任何行。");
  const cols = (r.columns || []).map((c) => c.name);
  const pkCols = new Set((r.columns || []).filter((c) => c.key === "PRI").map((c) => c.name));
  return <DataGrid columns={cols} rows={r.rows} pkCols={pkCols} onToast={onToast} onViewCell={onViewCell} rowOffset={(sr.page - 1) * sr.pageSize} />;
}

function SmallBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${T.line}`, background: T.card, color: T.dim, cursor: disabled ? "default" : "pointer", fontSize: 13, opacity: disabled ? 0.4 : 1 }}>
      {children}
    </button>
  );
}

function ErrorPanel({ code, msg, zh, onToast }: { code: string; msg: string; zh: string; onToast: (m: string) => void }) {
  return (
    <div style={{ padding: 18, height: "100%", overflow: "auto" }}>
      <div style={{ border: "1px solid #f3c3b6", background: "#fdf4f2", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#cf5a3a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>!</span>
          <span style={{ fontWeight: 700, color: "#a73c22" }}>执行失败</span>
          <span style={{ fontFamily: T.mono, fontSize: 11.5, color: "#cf5a3a", background: "#fbe3dc", padding: "2px 8px", borderRadius: 6 }}>ERR {code}</span>
        </div>
        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, marginBottom: 10 }}>{zh}</div>
        <pre style={{ margin: 0, background: T.card, border: `1px solid ${T.line}`, borderRadius: 9, padding: 12, fontFamily: T.mono, fontSize: 12, color: T.dim, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg}</pre>
        <div style={{ marginTop: 10 }}>
          <Btn kind="ghost" onClick={() => { void copy(msg); onToast("已复制错误信息"); }} style={{ paddingLeft: 0 }}>复制原始错误</Btn>
        </div>
      </div>
    </div>
  );
}
