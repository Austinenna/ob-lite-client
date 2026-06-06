import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { colWidth, statusStyle, T } from "../theme";
import { Cell as CellType } from "../types";
import { copy, fmtVal } from "./ui";

const ROW_H = 33;

function isNull(v: CellType): v is { __null: true } {
  return !!v && typeof v === "object" && "__null" in v;
}
function isBlob(v: CellType): v is { __blob: number } {
  return !!v && typeof v === "object" && "__blob" in v;
}

function CellContent({ v }: { v: CellType }) {
  if (isNull(v))
    return <span style={{ color: T.faint, fontSize: 11, fontWeight: 600, letterSpacing: ".03em" }}>null</span>;
  if (isBlob(v))
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.dim }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: "#8b6fce", background: "#f2ecfb", padding: "1px 6px", borderRadius: 10 }}>
          BLOB
        </span>
        {(v.__blob / 1024).toFixed(1)} KB
      </span>
    );
  return <span>{String(v)}</span>;
}

function StatusPill({ s }: { s: string }) {
  const st = statusStyle(s);
  if (!st) return <span>{s}</span>;
  return (
    <span style={{ color: st[0], background: st[1], fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {s}
    </span>
  );
}

export interface ViewCell {
  col: string;
  value: CellType;
}

export function DataGrid({
  columns,
  rows,
  pkCols,
  onToast,
  onViewCell,
  rowOffset = 0,
}: {
  columns: string[];
  rows: CellType[][];
  pkCols: Set<string>;
  onToast: (m: string) => void;
  onViewCell: (c: ViewCell) => void;
  rowOffset?: number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; r: number; c: number } | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 14,
  });

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const doCopy = (txt: string, label: string) => {
    void copy(txt);
    onToast(label);
    setMenu(null);
  };

  const totalW = 46 + columns.reduce((a, c) => a + colWidth(c), 0);

  return (
    <div ref={parentRef} style={{ position: "relative", height: "100%", overflow: "auto", fontSize: 12.5 }}>
      <div style={{ minWidth: totalW, position: "relative" }}>
        {/* header */}
        <div style={{ display: "flex", borderBottom: `1px solid ${T.line}`, background: "#fcfcfb", position: "sticky", top: 0, zIndex: 3 }}>
          <div style={{ width: 46, flexShrink: 0, padding: "9px 0", textAlign: "center", color: T.faint, position: "sticky", left: 0, background: "#fcfcfb", borderRight: `1px solid ${T.lineSoft}`, zIndex: 1 }}>
            #
          </div>
          {columns.map((col) => (
            <div
              key={col}
              style={{ width: colWidth(col), flexShrink: 0, padding: "9px 12px", fontWeight: 600, color: T.dim, fontSize: 11.5, display: "flex", gap: 5, alignItems: "center", fontFamily: T.mono }}
            >
              {col}
              {pkCols.has(col) && (
                <span style={{ fontSize: 8.5, fontWeight: 700, color: T.blue, background: T.blueSoft, padding: "1px 5px", borderRadius: 8, fontFamily: T.sans }}>PK</span>
              )}
            </div>
          ))}
        </div>

        {/* virtualized body */}
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const ri = vi.index;
            const row = rows[ri];
            const rowSel = sel?.r === ri;
            return (
              <div
                key={vi.key}
                style={{
                  position: "absolute", top: 0, left: 0, transform: `translateY(${vi.start}px)`, height: vi.size,
                  display: "flex", borderBottom: `1px solid ${T.lineSoft}`, background: rowSel ? "#fafbff" : "transparent",
                }}
              >
                <div style={{ width: 46, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.faint, fontVariantNumeric: "tabular-nums", position: "sticky", left: 0, background: rowSel ? "#fafbff" : T.card, borderRight: `1px solid ${T.lineSoft}`, zIndex: 1 }}>
                  {rowOffset + ri + 1}
                </div>
                {row.map((v, ci) => {
                  const isStatus = columns[ci] === "status" || columns[ci] === "level";
                  const selected = sel?.r === ri && sel?.c === ci;
                  return (
                    <div
                      key={ci}
                      onClick={() => setSel({ r: ri, c: ci })}
                      onDoubleClick={() => onViewCell({ col: columns[ci], value: v })}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSel({ r: ri, c: ci });
                        setMenu({ x: e.clientX, y: e.clientY, r: ri, c: ci });
                      }}
                      style={{
                        width: colWidth(columns[ci]), flexShrink: 0, padding: "0 12px", display: "flex", alignItems: "center",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        fontFamily: isStatus ? T.sans : T.mono, fontSize: 12, fontVariantNumeric: "tabular-nums", cursor: "default",
                        boxShadow: selected ? `inset 0 0 0 2px ${T.blue}` : "none", borderRadius: selected ? 4 : 0,
                      }}
                    >
                      {isStatus && typeof v === "string" ? <StatusPill s={v} /> : <CellContent v={v} />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {menu && (
        <div
          style={{
            position: "fixed", left: Math.min(menu.x, window.innerWidth - 180), top: menu.y, zIndex: 1000,
            background: T.card, borderRadius: 10, boxShadow: T.shadowLg, border: `1px solid ${T.line}`, padding: 5, minWidth: 168, fontSize: 12.5,
          }}
        >
          {(
            [
              ["复制单元格", () => doCopy(fmtVal(rows[menu.r][menu.c]), "已复制单元格")],
              ["复制整行", () => doCopy(rows[menu.r].map(fmtVal).join("\t"), "已复制整行")],
              ["复制列名+值", () => doCopy(`${columns[menu.c]} = ${fmtVal(rows[menu.r][menu.c])}`, "已复制")],
              ["__sep", () => {}],
              ["查看完整内容", () => { onViewCell({ col: columns[menu.c], value: rows[menu.r][menu.c] }); setMenu(null); }],
            ] as [string, () => void][]
          ).map((item, i) =>
            item[0] === "__sep" ? (
              <div key={i} style={{ height: 1, background: T.lineSoft, margin: "4px 6px" }} />
            ) : (
              <div key={i} onClick={item[1]} className="ob-menu-item" style={{ padding: "7px 10px", borderRadius: 7, cursor: "pointer", color: T.text }}>
                {item[0]}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
