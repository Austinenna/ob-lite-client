import { ENV, T } from "../theme";
import { Tab } from "../types";

export function TabStrip({
  tabs,
  activeId,
  env,
  onActivate,
  onClose,
  onNewQuery,
}: {
  tabs: Tab[];
  activeId: string | null;
  env: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onNewQuery: () => void;
}) {
  const m = ENV[env];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, overflowX: "auto", paddingBottom: 0 }}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const isQuery = tab.type === "query";
        return (
          <div
            key={tab.id}
            onClick={() => onActivate(tab.id)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px 8px 12px", borderRadius: "11px 11px 0 0", cursor: "pointer", flexShrink: 0, maxWidth: 220, background: active ? T.card : "transparent", boxShadow: active ? "0 -1px 4px rgba(20,20,30,.05)" : "none", borderTop: active ? `2px solid ${m.color}` : "2px solid transparent", position: "relative", top: active ? 0 : 1 }}
          >
            <span style={{ width: 9, height: 9, borderRadius: isQuery ? 3 : 2, background: isQuery ? "#cdb6ef" : active ? T.blue : "#cfd0d3", flexShrink: 0, transform: isQuery ? "rotate(45deg)" : "none" }} />
            <span style={{ fontSize: 12.5, fontWeight: active ? 600 : 500, color: active ? T.text : T.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: isQuery ? T.sans : T.mono }}>{tab.label}</span>
            <span
              onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              className="ob-tab-x"
              style={{ width: 16, height: 16, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", color: T.faint, fontSize: 13, flexShrink: 0 }}
            >
              ×
            </span>
          </div>
        );
      })}
      <button onClick={onNewQuery} title="新建查询" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, border: "none", background: "transparent", color: T.dim, fontSize: 17, cursor: "pointer", marginBottom: 1 }}>
        ＋
      </button>
    </div>
  );
}
