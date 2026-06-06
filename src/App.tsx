import { useCallback, useEffect, useMemo, useState } from "react";
import { api, uid } from "./api";
import { ENV, T } from "./theme";
import { metaStore } from "./store";
import {
  ConnectionConfig,
  ConnStatus,
  isAppError,
  QueryTab,
  Tab,
  TableTab,
  Workspace,
} from "./types";
import { ViewCell } from "./components/DataGrid";
import { Sidebar } from "./components/Sidebar";
import { ConnectionSwitcher } from "./components/ConnectionSwitcher";
import { ConnectionManager } from "./components/ConnectionManager";
import { TabStrip } from "./components/TabStrip";
import { TableView } from "./components/TableView";
import { QueryView } from "./components/QueryView";
import { CellDrawer } from "./components/CellDrawer";
import { Btn, EnvBadge, Toast } from "./components/ui";

const emptyWs = (): Workspace => ({ filter: "", activeTabId: null, tabs: [] });

export function App() {
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [activeConn, setActiveConn] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<Record<string, ConnStatus>>({});
  const [ws, setWs] = useState<Record<string, Workspace>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [cell, setCell] = useState<ViewCell | null>(null);
  const [showManager, setShowManager] = useState(false);

  const showToast = useCallback((m: string) => setToast(m), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const reloadConnections = useCallback(async () => {
    const list = await api.listConnections();
    setConnections(list);
    setWs((w) => {
      const next = { ...w };
      list.forEach((c) => { if (!next[c.id]) next[c.id] = emptyWs(); });
      return next;
    });
    setActiveConn((cur) => cur ?? list[0]?.id ?? null);
    if (list.length === 0) setShowManager(true);
  }, []);

  useEffect(() => { void reloadConnections(); }, [reloadConnections]);

  const conn = useMemo(() => connections.find((c) => c.id === activeConn) || null, [connections, activeConn]);
  const statusOf = useCallback((id: string): ConnStatus => connStatus[id] || "disconnected", [connStatus]);
  const wsData = (activeConn && ws[activeConn]) || emptyWs();
  const activeTab = wsData.tabs.find((t) => t.id === wsData.activeTabId) || null;

  // ---- workspace mutations (scoped to the active connection) ----
  const patchWs = (fn: (w: Workspace) => Workspace) => {
    if (!activeConn) return;
    setWs((all) => ({ ...all, [activeConn]: fn(all[activeConn] || emptyWs()) }));
  };
  const setFilter = (f: string) => patchWs((w) => ({ ...w, filter: f }));
  const activate = (id: string) => patchWs((w) => ({ ...w, activeTabId: id }));

  const openTable = (db: string, table: string) =>
    patchWs((w) => {
      const exist = w.tabs.find((t) => t.type === "table" && t.db === db && t.table === table);
      if (exist) return { ...w, activeTabId: exist.id };
      const id = uid("tb_");
      const tab: TableTab = { id, type: "table", db, table, label: table, pageSize: 50, page: 1, sub: "data" };
      return { ...w, tabs: [...w.tabs, tab], activeTabId: id };
    });

  const newQuery = () =>
    patchWs((w) => {
      const n = w.tabs.filter((t) => t.type === "query").length + 1;
      const id = uid("q_");
      const tab: QueryTab = { id, type: "query", label: `查询 ${n}`, sql: "", status: "idle", layout: "v", editorH: 180, editorPct: 48 };
      return { ...w, tabs: [...w.tabs, tab], activeTabId: id };
    });

  const closeTab = (id: string) =>
    patchWs((w) => {
      const idx = w.tabs.findIndex((t) => t.id === id);
      const tabs = w.tabs.filter((t) => t.id !== id);
      let active = w.activeTabId;
      if (active === id) active = tabs.length ? tabs[Math.max(0, idx - 1)].id : null;
      return { ...w, tabs, activeTabId: active };
    });

  const updateTab = (patch: Partial<Tab>) =>
    patchWs((w) => ({ ...w, tabs: w.tabs.map((t) => (t.id === w.activeTabId ? ({ ...t, ...patch } as Tab) : t)) }));

  // ---- connection lifecycle ----
  const connect = async (id: string) => {
    setConnStatus((s) => ({ ...s, [id]: "connecting" }));
    try {
      const r = await api.openConnection(id);
      setConnStatus((s) => ({ ...s, [id]: "connected" }));
      showToast(`已连接 · ${connections.find((c) => c.id === id)?.name ?? ""} · ${r.server}`);
      void metaStore.ensureDatabases(id);
    } catch (e) {
      setConnStatus((s) => ({ ...s, [id]: "disconnected" }));
      showToast(isAppError(e) ? e.zh : "连接失败");
    }
  };

  const disconnect = async (id: string) => {
    try { await api.closeConnection(id); } catch { /* ignore */ }
    setConnStatus((s) => ({ ...s, [id]: "disconnected" }));
    metaStore.clear(id);
    showToast("已断开连接");
  };

  const refreshObjects = () => {
    if (!activeConn) return;
    metaStore.clear(activeConn);
    void metaStore.ensureDatabases(activeConn);
    showToast("已刷新数据库对象");
  };

  const switchConn = (id: string) => {
    setActiveConn(id);
    if (statusOf(id) !== "connected") void connect(id);
  };

  // ---- render ----
  const env = conn ? ENV[conn.env] : ENV.dev;
  const connected = conn ? statusOf(conn.id) === "connected" : false;
  const activeKey = activeTab && activeTab.type === "table" && conn ? `${conn.id}/${activeTab.db}/${activeTab.table}` : null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.canvas, fontFamily: T.sans, color: T.text, fontSize: 13, position: "relative" }}>
      <div style={{ height: conn?.env === "prod" ? 4 : 3, background: env.color, flexShrink: 0 }} />

      {/* header */}
      <div style={{ height: 56, display: "flex", alignItems: "center", gap: 14, padding: "0 18px", flexShrink: 0 }} data-tauri-drag-region>
        <div style={{ display: "flex", gap: 7, paddingLeft: 60 }} />
        {conn ? (
          <ConnectionSwitcher conn={conn} connections={connections} statusOf={statusOf} onSwitch={switchConn} onManage={() => setShowManager(true)} />
        ) : (
          <Btn kind="primary" onClick={() => setShowManager(true)}>＋ 新建连接</Btn>
        )}
        {connected && conn && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: T.dim, fontSize: 13 }}>
            <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{activeTab && activeTab.type === "table" ? activeTab.db : conn.primary || conn.database}</span>
            {activeTab && (
              <>
                <span style={{ color: T.faint }}>›</span>
                <span style={{ background: T.blueSoft, color: T.blue, fontWeight: 600, padding: "3px 10px", borderRadius: 16, fontFamily: activeTab.type === "table" ? T.mono : T.sans, fontSize: 12, whiteSpace: "nowrap" }}>
                  {activeTab.type === "table" ? activeTab.table : activeTab.label}
                </span>
              </>
            )}
          </div>
        )}
        <div style={{ flex: 1 }} />
        {conn?.env === "prod" && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: env.soft, color: env.color, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1px solid ${env.ring}`, whiteSpace: "nowrap" }}>
            <span>⚠</span> 生产环境 · 谨慎操作
          </div>
        )}
        {connected && (
          <Btn kind="ghost" onClick={() => conn && disconnect(conn.id)}>断开</Btn>
        )}
        <Btn kind="default" onClick={refreshObjects} title="刷新数据库对象" style={{ width: 32, height: 32, padding: 0, justifyContent: "center", fontSize: 14 }}>↻</Btn>
      </div>

      {/* body */}
      {!conn ? (
        <NoConnections onAdd={() => setShowManager(true)} />
      ) : connected ? (
        <div style={{ flex: 1, display: "flex", gap: 14, padding: "0 14px 14px", minHeight: 0 }}>
          <Sidebar conn={conn} filter={wsData.filter} onFilter={setFilter} onOpenTable={openTable} activeKey={activeKey} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ padding: "0 4px", flexShrink: 0 }}>
              <TabStrip tabs={wsData.tabs} activeId={wsData.activeTabId} env={conn.env} onActivate={activate} onClose={closeTab} onNewQuery={newQuery} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {!activeTab && <EmptyTabs onNewQuery={newQuery} />}
              {activeTab && activeTab.type === "table" && (
                <TableView key={activeTab.id} conn={conn} tab={activeTab} onUpdateTab={updateTab} onToast={showToast} onViewCell={setCell} />
              )}
              {activeTab && activeTab.type === "query" && (
                <QueryView key={activeTab.id} conn={conn} tab={activeTab} onUpdateTab={updateTab} onToast={showToast} onViewCell={setCell} onAfterExec={() => {}} />
              )}
            </div>
          </div>
        </div>
      ) : (
        <DisconnectedView conn={conn} onConnect={() => connect(conn.id)} connecting={statusOf(conn.id) === "connecting"} />
      )}

      {showManager && (
        <ConnectionManager
          connections={connections}
          onClose={() => setShowManager(false)}
          onChanged={() => void reloadConnections()}
          onToast={showToast}
        />
      )}
      <CellDrawer cell={cell} onClose={() => setCell(null)} />
      <Toast msg={toast} />
    </div>
  );
}

function EmptyTabs({ onNewQuery }: { onNewQuery: () => void }) {
  return (
    <div style={{ flex: 1, background: T.card, borderRadius: 16, boxShadow: T.shadow, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: T.faint }}>
      <div style={{ fontSize: 28 }}>▦</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.dim }}>没有打开的标签页</div>
      <div style={{ fontSize: 12.5 }}>从左侧点击一张表打开数据，或</div>
      <Btn kind="primary" onClick={onNewQuery}>＋ 新建查询</Btn>
    </div>
  );
}

function DisconnectedView({ conn, onConnect, connecting }: { conn: ConnectionConfig; onConnect: () => void; connecting: boolean }) {
  const env = ENV[conn.env];
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
      <div style={{ background: T.card, borderRadius: 18, boxShadow: T.shadow, padding: 32, width: 440, textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: env.soft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22, color: env.color }}>○</div>
        <EnvBadge env={conn.env} />
        <div style={{ fontSize: 18, fontWeight: 700, margin: "10px 0 4px" }}>{conn.name}</div>
        <div style={{ fontFamily: T.mono, fontSize: 12.5, color: T.faint, marginBottom: 4 }}>{conn.user}</div>
        <div style={{ fontFamily: T.mono, fontSize: 12.5, color: T.faint, marginBottom: 20 }}>{conn.host}:{conn.port}</div>
        <div style={{ fontSize: 13, color: T.dim, marginBottom: 20, lineHeight: 1.6 }}>该连接当前未打开。点击下方按钮建立连接，连接成功后即可浏览数据库对象。</div>
        <Btn kind="primary" onClick={onConnect} style={{ width: "100%", justifyContent: "center", padding: "10px" }}>{connecting ? "连接中…" : "测试并连接"}</Btn>
      </div>
    </div>
  );
}

function NoConnections({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
      <div style={{ background: T.card, borderRadius: 18, boxShadow: T.shadow, padding: 36, width: 440, textAlign: "center" }}>
        <div style={{ fontSize: 30, marginBottom: 12 }}>🗄️</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>还没有任何连接</div>
        <div style={{ fontSize: 13, color: T.dim, marginBottom: 20, lineHeight: 1.6 }}>新建一个 OceanBase（MySQL 模式）连接，开始浏览数据库与执行 SQL。</div>
        <Btn kind="primary" onClick={onAdd} style={{ width: "100%", justifyContent: "center", padding: "10px" }}>＋ 新建连接</Btn>
      </div>
    </div>
  );
}
