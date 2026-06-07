import React, { useRef, useState } from "react";
import { api, uid } from "../api";
import { T } from "../theme";
import { ConnectionConfig, QueryTab, isAppError } from "../types";
import { DataGrid, ViewCell } from "./DataGrid";
import { SqlEditor, SqlEditorHandle } from "./SqlEditor";
import { Btn, copy, Segmented } from "./ui";

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
  // holds the queryId the user cancelled, so a late-returning request is ignored
  const cancelledRef = useRef<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // server-side pagination state (LIMIT/OFFSET re-issued per page)
  const [resPage, setResPage] = useState(1);
  const [resPageSize, setResPageSize] = useState(50);

  const status = tab.status || "idle";
  const layout = tab.layout || "v";
  const editorH = tab.editorH || 180;
  const editorPct = tab.editorPct || 48;
  const db = conn.database || conn.primary || undefined;

  // Execute `sqlText` at `page` with `size` rows/page. Paging re-runs the same
  // SQL server-side (LIMIT/OFFSET), so we never over-fetch.
  const run = async (sqlText: string, page: number, size: number) => {
    const text = sqlText.trim();
    if (!text) return;
    const queryId = uid("q_");
    onUpdateTab({ status: "running", queryId, error: undefined, executedSql: text });
    try {
      const r = await api.executeSql({ id: conn.id, sql: text, queryId, database: db, page, pageSize: size });
      // if the user asked to cancel, only confirm "cancelled" now that the
      // request actually returned (i.e. the DB really stopped) — don't show results
      if (cancelledRef.current === queryId) { onUpdateTab({ status: "cancelled" }); return; }
      setResPage(page);
      onUpdateTab({ status: r.kind === "rows" ? "rows" : "affected", result: r });
    } catch (e) {
      if (cancelledRef.current === queryId) { onUpdateTab({ status: "cancelled" }); return; }
      if (isAppError(e) && e.code === "TIMEOUT") onUpdateTab({ status: "timeout", error: e });
      else onUpdateTab({ status: "error", error: isAppError(e) ? e : { code: "ERR", msg: String(e), zh: "执行失败" } });
    } finally {
      onAfterExec();
    }
  };

  // run a fresh statement (from the editor) starting at page 1
  const runFresh = (text?: string) => run(text ?? tab.sql, 1, resPageSize);
  // re-run the last executed statement at a different page
  const goPage = (page: number) => run(tab.executedSql || tab.sql, page, resPageSize);
  const changePageSize = (size: number) => { setResPageSize(size); run(tab.executedSql || tab.sql, 1, size); };

  // Cancel honestly: show "cancelling…" right away and fire the server-side
  // KILL, but only switch to "cancelled" once the in-flight request actually
  // returns (handled in run()) — i.e. once the DB has really stopped.
  // Triggered by the editor's Esc keymap (only while focused) or the button.
  const cancel = () => {
    const qid = tab.queryId;
    if (!qid) { onUpdateTab({ status: "cancelled" }); return; }
    cancelledRef.current = qid;
    onUpdateTab({ status: "cancelling" });
    void api.cancelQuery(qid).catch(() => {});
  };

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

  // the result already IS one page (server-side LIMIT/OFFSET)
  const pageRows = tab.result?.rows || [];
  const hasMore = !!tab.result?.hasMore;
  const resOffset = (resPage - 1) * resPageSize;

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
      <span style={{ fontSize: 11, color: T.faint, fontFamily: T.mono, whiteSpace: "nowrap" }}>⌘↵ 执行 · esc 取消</span>
      <Btn kind="ghost" onClick={() => onUpdateTab({ sql: "", status: "idle", result: undefined, error: undefined })}>清空</Btn>
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

  const resultsHeader = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${T.lineSoft}`, flexShrink: 0, overflow: "hidden" }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".04em", color: T.faint }}>查询结果</span>
      <StatusChip tab={tab} />
      <div style={{ flex: 1, minWidth: 8 }} />
      {status === "rows" && tab.result && (
        <>
          <span style={{ fontSize: 11.5, color: T.faint }}>每页</span>
          <Segmented options={["20", "50", "100", "200"]} value={String(resPageSize)} onChange={(v) => changePageSize(+v)} />
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
            <SmallBtn onClick={() => goPage(resPage - 1)} disabled={resPage <= 1}>‹</SmallBtn>
            <span style={{ fontSize: 12, color: T.dim, fontVariantNumeric: "tabular-nums", minWidth: 44, textAlign: "center" }}>第 {resPage} 页</span>
            <SmallBtn onClick={() => goPage(resPage + 1)} disabled={!hasMore}>›</SmallBtn>
          </div>
          <Btn kind="ghost" onClick={() => { void copy(pageRows.map((r) => r.map((c) => (typeof c === "string" ? c : "")).join("\t")).join("\n")); onToast(`已复制本页（${pageRows.length} 行）`); }}>复制本页</Btn>
          <Btn kind="ghost" onClick={() => onUpdateTab({ status: "idle", result: undefined })}>清空</Btn>
        </>
      )}
    </div>
  );

  const resultsCard = (
    <div style={{ ...card, flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {resultsHeader}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <ResultBody tab={tab} onToast={onToast} onViewCell={onViewCell} onRun={() => runFresh()} pageRows={pageRows} rowOffset={resOffset} />
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

function StatusChip({ tab }: { tab: QueryTab }) {
  const status = tab.status || "idle";
  const dot = (c: string) => <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0 }} />;
  const wrap = (children: React.ReactNode) => <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: T.dim }}>{children}</span>;
  const ms = tab.result?.durationMs;
  if (status === "idle") return wrap(<>{dot("#cfd0d3")}未执行</>);
  if (status === "running") return wrap(<><span className="ob-spin" style={{ width: 11, height: 11, border: `2px solid ${T.blueSoft}`, borderTopColor: T.blue, borderRadius: "50%", display: "inline-block" }} />执行中…</>);
  if (status === "cancelling") return wrap(<><span className="ob-spin" style={{ width: 11, height: 11, border: "2px solid #f3c3b6", borderTopColor: "#cf5a3a", borderRadius: "50%", display: "inline-block" }} /><span style={{ color: "#cf5a3a" }}>正在取消…</span></>);
  if (status === "rows") return wrap(<>{dot("#2bb86b")}<b style={{ color: T.text, fontVariantNumeric: "tabular-nums" }}>{tab.result?.rowCount}</b> 行 · <span style={{ fontVariantNumeric: "tabular-nums" }}>{ms} ms</span></>);
  if (status === "affected") return wrap(<>{dot("#2bb86b")}执行成功 · 影响 <b style={{ color: T.text }}>{tab.result?.affected}</b> 行 · {ms} ms</>);
  if (status === "error") return wrap(<>{dot("#cf5a3a")}<span style={{ color: "#cf5a3a", fontWeight: 600 }}>执行失败</span></>);
  if (status === "cancelled") return wrap(<>{dot("#b5851a")}已取消</>);
  if (status === "timeout") return wrap(<>{dot("#cf5a3a")}<span style={{ color: "#cf5a3a", fontWeight: 600 }}>查询超时</span></>);
  return null;
}

function SmallBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${T.line}`, background: T.card, color: T.dim, cursor: disabled ? "default" : "pointer", fontSize: 13, opacity: disabled ? 0.4 : 1 }}>
      {children}
    </button>
  );
}

function ResultBody({ tab, onToast, onViewCell, onRun, pageRows, rowOffset }: { tab: QueryTab; onToast: (m: string) => void; onViewCell: (c: ViewCell) => void; onRun: () => void; pageRows: import("../types").Cell[][]; rowOffset: number }) {
  const status = tab.status || "idle";
  const empty = (icon: string, title: string, desc?: string, extra?: React.ReactNode) => (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: T.faint, padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 26 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.dim }}>{title}</div>
      {desc && <div style={{ fontSize: 12.5, maxWidth: 420, lineHeight: 1.6 }}>{desc}</div>}
      {extra}
    </div>
  );

  if (status === "idle") return empty("⌘↵", "尚未执行查询", "在上方输入 SQL，按 ⌘↵ 执行。SELECT / SHOW / EXPLAIN 返回结果表格，其它语句返回影响行数。");
  if (status === "running")
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: T.dim }}>
        <span className="ob-spin" style={{ width: 16, height: 16, border: `2.5px solid ${T.blueSoft}`, borderTopColor: T.blue, borderRadius: "50%" }} />
        正在执行，可按 esc 取消…
      </div>
    );
  if (status === "cancelling")
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#cf5a3a" }}>
        <span className="ob-spin" style={{ width: 16, height: 16, border: "2.5px solid #f3c3b6", borderTopColor: "#cf5a3a", borderRadius: "50%" }} />
        正在取消查询，等待数据库确认停止…
      </div>
    );
  if (status === "cancelled") return empty("⊘", "查询已取消", "上一次执行被手动取消。", <Btn kind="default" onClick={onRun} style={{ marginTop: 6 }}>重新执行</Btn>);
  if (status === "affected") return empty("✓", "执行成功", `语句执行完成，影响 ${tab.result?.affected ?? 0} 行，耗时 ${tab.result?.durationMs ?? 0} ms。无结果集返回。`);
  if (status === "timeout" || status === "error") {
    const err = tab.error;
    return <ErrorPanel code={err?.code || "ERR"} msg={err?.msg || ""} zh={err?.zh || "执行失败"} onToast={onToast} />;
  }
  if (status === "rows") {
    const r = tab.result;
    if (!r || !r.rows || r.rows.length === 0) return empty("∅", "执行成功，无结果", "查询正常执行，但没有返回任何行。");
    const cols = (r.columns || []).map((c) => c.name);
    const pkCols = new Set((r.columns || []).filter((c) => c.key === "PRI").map((c) => c.name));
    return <DataGrid columns={cols} rows={pageRows} pkCols={pkCols} onToast={onToast} onViewCell={onViewCell} rowOffset={rowOffset} />;
  }
  return null;
}

function ErrorPanel({ code, msg, zh, onToast }: { code: string; msg: string; zh: string; onToast: (m: string) => void }) {
  return (
    <div style={{ padding: 18 }}>
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
