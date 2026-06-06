// V2 — Pro developer tool. Cool grays, icon activity rail, monospace,
// results docked at bottom with sub-tabs (Result / Messages / EXPLAIN),
// rich technical status bar. Squared corners, tighter rhythm.
(function () {
  const { useState } = React;
  const D = window.OB;

  const c = {
    win: '#fbfbfc',
    panel: '#ffffff',
    rail: '#23262e',
    railText: '#9aa0ab',
    railActive: '#fff',
    explorer: '#f1f2f5',
    text: '#1a1c22',
    dim: '#5b606b',
    faint: '#9aa0ab',
    line: '#e4e6ea',
    lineSoft: '#eef0f3',
    blue: '#2a64d8',
    blueSoft: '#e8eefc',
    head: '#f4f5f7',
    mono: 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace',
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  };

  function Cell({ v }) {
    if (v && v.__null) return <span style={{ color: '#c0392b', opacity: .65, fontStyle: 'italic' }}>NULL</span>;
    if (v && v.__blob) return <span style={{ color: c.faint }}>‹blob {(v.__blob / 1024).toFixed(1)}KB›</span>;
    return <span>{String(v)}</span>;
  }
  function statusColor(s) {
    return ({ PAID: '#1f7a3d', CREATED: '#9a7b00', REFUNDING: '#c0392b', CANCELLED: '#8a8f99', SHIPPED: '#2a64d8' }[s]) || c.dim;
  }

  function RailIcon({ glyph, active, label }) {
    return (
      <div title={label} style={{ width: 44, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', color: active ? c.railActive : c.railText }}>
        {active && <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 2.5, background: c.blue, borderRadius: 2 }} />}
        <span style={{ fontSize: 17 }}>{glyph}</span>
      </div>
    );
  }

  function WorkspaceV2() {
    const [stab, setStab] = useState('result');
    const widths = [56, 150, 92, 96, 100, 60, 140, 110, 148];
    return (
      <div style={{ width: '100%', height: '100%', background: c.win, fontFamily: c.sans, color: c.text, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontSize: 12.5 }}>
        {/* top bar */}
        <div style={{ height: 36, background: c.head, borderBottom: `1px solid ${c.line}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 7 }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((x) => <span key={x} style={{ width: 11, height: 11, borderRadius: '50%', background: x }} />)}
          </div>
          <div style={{ width: 1, height: 16, background: c.line, margin: '0 4px' }} />
          <span style={{ fontFamily: c.mono, fontSize: 11.5, color: c.dim }}>obclient</span>
          <span style={{ color: c.faint }}>—</span>
          <span style={{ fontWeight: 600, fontFamily: c.mono, fontSize: 11.5 }}>{D.connection.user}</span>
          <span style={{ fontFamily: c.mono, fontSize: 11.5, color: c.faint }}>{D.connection.host}:{D.connection.port}</span>
          <div style={{ flex: 1 }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#1f7a3d', fontWeight: 600 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#28c840' }} />CONNECTED</span>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* activity rail */}
          <div style={{ width: 44, background: c.rail, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6, flexShrink: 0 }}>
            <RailIcon glyph="▤" active label="对象" />
            <RailIcon glyph="↻" label="历史" />
            <RailIcon glyph="★" label="收藏" />
            <RailIcon glyph="⚙" label="设置" />
          </div>

          {/* explorer */}
          <div style={{ width: 230, background: c.explorer, borderRight: `1px solid ${c.line}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ height: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', borderBottom: `1px solid ${c.line}` }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', color: c.faint }}>对象浏览器</span>
              <span style={{ color: c.faint, cursor: 'pointer' }}>↻</span>
            </div>
            <div style={{ padding: 8 }}>
              <div style={{ background: c.panel, border: `1px solid ${c.line}`, borderRadius: 4, padding: '5px 8px', color: c.faint, fontSize: 11.5, fontFamily: c.mono }}>filter…</div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', fontFamily: c.mono, fontSize: 12 }}>
              {D.tree.map((node) => (
                <div key={node.db}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', color: node.open ? c.text : c.dim, fontWeight: node.open ? 600 : 400 }}>
                    <span style={{ width: 9, color: c.faint, fontSize: 9 }}>{node.open ? '▾' : '▸'}</span>
                    <span style={{ color: c.blue }}>▤</span>
                    <span>{node.db}</span>
                  </div>
                  {node.open && node.tables.map((t) => (
                    <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px 3px 30px',
                      background: t.active ? c.blueSoft : 'transparent', color: t.active ? c.blue : c.dim, fontWeight: t.active ? 600 : 400 }}>
                      <span style={{ color: t.type === 'view' ? '#a06fd0' : (t.active ? c.blue : c.faint), fontSize: 11 }}>{t.type === 'view' ? '◫' : '▦'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* main column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* editor tab strip */}
            <div style={{ height: 30, background: c.head, borderBottom: `1px solid ${c.line}`, display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', background: c.panel, borderRight: `1px solid ${c.line}`, borderTop: `2px solid ${c.blue}`, fontSize: 11.5, fontFamily: c.mono }}>
                查询 1 <span style={{ color: c.faint }}>×</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', color: c.faint }}>+</div>
            </div>

            {/* editor toolbar */}
            <div style={{ height: 36, borderBottom: `1px solid ${c.line}`, background: c.panel, display: 'flex', alignItems: 'center', gap: 7, padding: '0 10px', flexShrink: 0 }}>
              <button style={btnPrimary(c)}>▶ 运行</button>
              <button style={btn(c)}>运行选中</button>
              <button style={btn(c)}>EXPLAIN</button>
              <button style={btnGhost(c)}>清空</button>
              <div style={{ width: 1, height: 18, background: c.line, margin: '0 3px' }} />
              <span style={{ color: c.faint, fontSize: 11, fontFamily: c.mono, whiteSpace: 'nowrap' }}>⌘↵ 运行 · esc 取消</span>
            </div>

            {/* editor */}
            <div style={{ height: 150, display: 'flex', background: c.panel, borderBottom: `1px solid ${c.line}`, flexShrink: 0 }}>
              <div style={{ width: 40, background: '#f6f7f9', borderRight: `1px solid ${c.lineSoft}`, textAlign: 'right', padding: '10px 0', color: c.faint, fontFamily: c.mono, fontSize: 12, lineHeight: '20px' }}>
                {[1, 2, 3, 4, 5].map((n) => <div key={n} style={{ paddingRight: 9 }}>{n}</div>)}
              </div>
              <pre style={{ margin: 0, padding: '10px 12px', fontFamily: c.mono, fontSize: 12.5, lineHeight: '20px', flex: 1, whiteSpace: 'pre' }}>
                <span style={{ color: c.blue, fontWeight: 600 }}>SELECT</span> *{'\n'}
                <span style={{ color: c.blue, fontWeight: 600 }}>FROM</span> orders{'\n'}
                <span style={{ color: c.blue, fontWeight: 600 }}>WHERE</span> status <span style={{ color: c.dim }}>=</span> <span style={{ color: '#1f7a3d' }}>'PAID'</span>{'\n'}
                <span style={{ color: c.blue, fontWeight: 600 }}>ORDER BY</span> created_at <span style={{ color: c.blue, fontWeight: 600 }}>DESC</span>{'\n'}
                <span style={{ color: c.blue, fontWeight: 600 }}>LIMIT</span> <span style={{ color: '#9a7b00' }}>200</span>;
              </pre>
            </div>

            {/* results dock */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: c.panel }}>
              <div style={{ height: 30, borderBottom: `1px solid ${c.line}`, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {[['result', '结果集 (200)'], ['msg', '消息'], ['explain', 'EXPLAIN']].map(([k, label]) => (
                  <button key={k} onClick={() => setStab(k)} style={{ border: 'none', background: 'none', padding: '0 13px', height: '100%', fontSize: 11.5, fontFamily: c.mono, cursor: 'pointer', whiteSpace: 'nowrap',
                    color: stab === k ? c.text : c.faint, fontWeight: stab === k ? 700 : 500, borderBottom: stab === k ? `2px solid ${c.blue}` : '2px solid transparent' }}>{label}</button>
                ))}
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', color: c.faint, fontSize: 11, fontFamily: c.mono }}>
                  <span>200 行 / 200 限制</span>
                  <button style={pageBtn(c)}>‹</button><span>1/1</span><button style={pageBtn(c)}>›</button>
                  <span style={{ color: c.dim, cursor: 'pointer' }}>复制全部</span>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {stab === 'result' && (
                  <div style={{ fontFamily: c.mono, fontSize: 11.5 }}>
                    <div style={{ display: 'flex', background: c.head, borderBottom: `1px solid ${c.line}` }}>
                      <div style={{ width: 36, flexShrink: 0, padding: '5px 0', textAlign: 'center', color: c.faint, borderRight: `1px solid ${c.lineSoft}` }}>#</div>
                      {D.resultCols.map((col, i) => (
                        <div key={col} style={{ width: widths[i], flexShrink: 0, padding: '5px 8px', color: c.dim, fontWeight: 700, borderRight: `1px solid ${c.lineSoft}`, display: 'flex', gap: 4, alignItems: 'center' }}>
                          {col}{col === 'id' && <span style={{ color: '#c18401' }}>🔑</span>}
                        </div>
                      ))}
                    </div>
                    {D.rows.map((r, ri) => (
                      <div key={ri} style={{ display: 'flex', borderBottom: `1px solid ${c.lineSoft}` }}>
                        <div style={{ width: 36, flexShrink: 0, padding: '4px 0', textAlign: 'center', color: c.faint, borderRight: `1px solid ${c.lineSoft}`, background: c.head, fontVariantNumeric: 'tabular-nums' }}>{ri + 1}</div>
                        {r.map((v, ci) => (
                          <div key={ci} style={{ width: widths[ci], flexShrink: 0, padding: '4px 8px', borderRight: `1px solid ${c.lineSoft}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            color: D.resultCols[ci] === 'status' ? statusColor(v) : c.text, fontWeight: D.resultCols[ci] === 'status' ? 600 : 400, fontVariantNumeric: 'tabular-nums' }}>
                            <Cell v={v} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {stab === 'msg' && (
                  <div style={{ padding: 14, fontFamily: c.mono, fontSize: 12, color: c.dim, lineHeight: 1.7 }}>
                    <div style={{ color: '#1f7a3d' }}>[09:51:02] OK — 200 rows in set</div>
                    <div>查询耗时 42 ms · 限制 200 行 · 主键分页 (id)</div>
                    <div style={{ color: c.faint }}>SET NAMES utf8mb4; 已应用</div>
                  </div>
                )}
                {stab === 'explain' && (
                  <div style={{ padding: 14, fontFamily: c.mono, fontSize: 11.5, color: c.dim }}>
                    <div style={{ display: 'flex', gap: 24, color: c.faint, borderBottom: `1px solid ${c.line}`, paddingBottom: 6, marginBottom: 6 }}>
                      <span>id</span><span>select_type</span><span>table</span><span>type</span><span>key</span><span>rows</span>
                    </div>
                    <div style={{ display: 'flex', gap: 24 }}><span>1</span><span style={{ width: 70 }}>SIMPLE</span><span style={{ width: 40 }}>orders</span><span style={{ width: 30 }}>ref</span><span style={{ width: 24 }}>idx_status</span><span>198</span></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* rich status bar */}
        <div style={{ height: 24, background: c.head, borderTop: `1px solid ${c.line}`, display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0, fontSize: 11, fontFamily: c.mono, color: c.dim }}>
          {[
            ['● 已连接', '#1f7a3d'], [D.connection.name, null], ['db: order_center', null], ['utf8mb4', null],
          ].map(([t, col], i) => <span key={i} style={{ padding: '0 12px', borderRight: `1px solid ${c.line}`, color: col || c.dim }}>{t}</span>)}
          <div style={{ flex: 1 }} />
          {['42 ms', '200 行', 'OB 4.2 MySQL', 'ping 3ms'].map((t, i) => <span key={i} style={{ padding: '0 12px', borderLeft: `1px solid ${c.line}` }}>{t}</span>)}
        </div>
      </div>
    );
  }

  function btn(c) { return { background: c.panel, border: `1px solid ${c.line}`, borderRadius: 4, padding: '4px 10px', fontSize: 11.5, color: c.text, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }; }
  function btnGhost(c) { return { background: 'none', border: 'none', padding: '4px 8px', fontSize: 11.5, color: c.dim, cursor: 'pointer', whiteSpace: 'nowrap' }; }
  function btnPrimary(c) { return { background: c.blue, border: 'none', borderRadius: 4, padding: '5px 12px', fontSize: 11.5, color: '#fff', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }; }
  function pageBtn(c) { return { background: c.panel, border: `1px solid ${c.line}`, borderRadius: 3, width: 18, height: 18, fontSize: 10, color: c.dim, cursor: 'pointer' }; }

  window.WorkspaceV2 = WorkspaceV2;
})();
