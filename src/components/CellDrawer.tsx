import { T } from "../theme";
import { Cell } from "../types";
import { Btn, copy } from "./ui";
import { ViewCell } from "./DataGrid";

export function CellDrawer({ cell, onClose }: { cell: ViewCell | null; onClose: () => void }) {
  if (!cell) return null;
  const v: Cell = cell.value;
  const nul = !!v && typeof v === "object" && "__null" in v;
  const blob = !!v && typeof v === "object" && "__blob" in v;
  const text = nul
    ? "NULL"
    : blob
    ? `(二进制数据，${((v as { __blob: number }).__blob / 1024).toFixed(1)} KB，已省略，不直接渲染)`
    : String(v);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 900, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,20,30,.14)" }} />
      <div style={{ position: "relative", width: 380, height: "100%", background: T.card, boxShadow: "-8px 0 30px rgba(20,20,30,.16)", display: "flex", flexDirection: "column", animation: "obSlide .18s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: `1px solid ${T.lineSoft}` }}>
          <div>
            <div style={{ fontSize: 11, color: T.faint, fontWeight: 600, letterSpacing: ".04em" }}>单元格内容</div>
            <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 600, color: T.text, marginTop: 2 }}>{cell.col}</div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: T.canvas, borderRadius: 9, width: 30, height: 30, cursor: "pointer", color: T.dim, fontSize: 16 }}>
            ×
          </button>
        </div>
        <div style={{ padding: 18, flex: 1, overflow: "auto" }}>
          {blob && (
            <div style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: "#8b6fce", background: "#f2ecfb", padding: "3px 9px", borderRadius: 8, marginBottom: 12 }}>
              BLOB · 二进制字段
            </div>
          )}
          <div style={{ fontFamily: nul || blob ? T.sans : T.mono, fontSize: 13, lineHeight: 1.7, color: nul ? T.faint : T.text, whiteSpace: "pre-wrap", wordBreak: "break-word", fontStyle: nul ? "italic" : "normal" }}>
            {text}
          </div>
          <div style={{ marginTop: 14, fontSize: 11.5, color: T.faint }}>
            长度 {nul || blob ? 0 : String(v).length} 字符
          </div>
        </div>
        <div style={{ padding: 14, borderTop: `1px solid ${T.lineSoft}`, display: "flex", gap: 8 }}>
          <Btn kind="default" onClick={() => void copy(text)} style={{ flex: 1, justifyContent: "center" }}>
            复制内容
          </Btn>
          <Btn kind="primary" onClick={onClose} style={{ justifyContent: "center" }}>
            关闭
          </Btn>
        </div>
      </div>
    </div>
  );
}
