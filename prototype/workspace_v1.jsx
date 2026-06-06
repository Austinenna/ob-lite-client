// V1 — Native macOS. System font, neutral grays, unified toolbar,
// editor stacked over results. The "by the book" macOS DB client.
(function () {
  const { useState } = React;
  const D = window.OB;

  const c = {
    win: '#ffffff',
    chrome: '#ecebe9',
    chromeLine: '#d7d5d2',
    sidebar: '#f4f3f1',
    text: '#1d1d1f',
    dim: '#6e6e73',
    faint: '#8e8e93',
    line: '#e3e1de',
    sel: '#0a66d6',
    selSoft: '#e7f0fc',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  };

  function Light(p) {
    return <span style={{ width: 12, height: 12, borderRadius: '50%', background: p.c, display: 'inline-block' }} />;
  }

  function Cell({ v }) {
    if (v && v.__null) return <span style={{ color: c.faint, fontStyle: 'italic' }}>NULL</span>;
    if (v && v.__blob) return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: c.dim }}>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.04em', padding: '1px 5px', borderRadius: 4, background: '#eceae7', color: '#7a7873' }}>BLOB</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{(v.__blob / 1024).toFixed(1)} KB</span>
      </span>
    );
    return <span>{String(v)}</span>;
  }

  function StatusPill({ s }) {
    const map = {
      PAID: ['#1f7a3d', '#e6f4ea'], CREATED: ['#8a6d00', '#fbf2d6'], REFUNDING: ['#9a3a1f', '#fbe6df'],
      CANCELLED: ['#6e6e73', '#eceae7'], SHIPPED: ['#0a66d6', '#e7f0fc'],
    };
    const [fg, bg] = map[s] || ['#6e6e73', '#eceae7'];
    return <span style={{ color: fg, background: bg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5 }}>{s}</span>;
  }

  function WorkspaceV1() {
    const [tab, setTab] = useState('result');
    return (
      <div style={{ width: '100%', height: '100%', background: c.win, fontFamily: c.sans, color: c.text, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontSize: 13 }}>
        {/* title bar */}
        <div style={{ height: 38, background: c.chrome, borderBottom: `1px solid ${c.chromeLine}`, display: 'flex', alignItems: 'center', padding: '0 14px', flexShrink: 0, position: 'relative' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Light c="#ff5f57" /><Light c="#febc2e" /><Light c="#28c840" />
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 13, fontWeight: 600, color: c.dim, pointerEvents: 'none' }}>
            OB Lite · order_center
          </div>
        </div>

        {/* toolbar */}
        <div style={{ height: 46, background: c.chrome, borderBottom: `1px solid ${c.chromeLine}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: c.win, border: `1px solid ${c.line}`, borderRadius: 7, padding: '5px 10px', whiteSpace: 'nowrap' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#28c840', flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{D.connection.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.dim }}>
            <span style={{ color: c.faint }}>数据库</span>
            <span style={{ background: c.win, border: `1px solid ${c.line}`, borderRadius: 6, padding: '4px 9px', fontWeight: 500, color: c.text }}>order_center ▾</span>
          </div>
          <div style={{ flex: 1 }} />
          <button style={{ ...btn(c), display: 'flex', alignItems: 'center', gap: 6 }}>↻ 刷新</button>
        </div>

        {/* body */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* sidebar */}
          <div style={{ width: 244, background: c.sidebar, borderRight: `1px solid ${c.line}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: 10 }}>
              <div style={{ background: c.win, border: `1px solid ${c.line}`, borderRadius: 7, padding: '6px 9px', color: c.faint, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span>⌕</span><span>筛选表…</span>
              </div>
            </div>
            <div style={{ overflow: 'hidden', padding: '0 6px', flex: 1 }}>
              {D.tree.map((node) => (
                <div key={node.db}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', borderRadius: 6, fontWeight: node.open ? 600 : 500, color: node.open ? c.text : c.dim }}>
                    <span style={{ width: 12, color: c.faint, fontSize: 10 }}>{node.open ? '▾' : '▸'}</span>
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: node.open ? c.sel : '#c7c5c1', flexShrink: 0 }} />
                    <span>{node.db}</span>
                  </div>
                  {node.open && node.tables.map((t) => (
                    <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 6px 4px 30px', borderRadius: 6, marginLeft: 2,
                      background: t.active ? c.selSoft : 'transparent', color: t.active ? c.sel : c.dim, fontWeight: t.active ? 600 : 400 }}>
                      <span style={{ width: 11, height: 11, borderRadius: 2, border: `1.5px solid ${t.type === 'view' ? '#a06fd0' : (t.active ? c.sel : '#b6b4b0')}`, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* main */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* editor toolbar */}
            <div style={{ height: 40, borderBottom: `1px solid ${c.line}`, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', flexShrink: 0 }}>
              <button style={{ ...btnPrimary(c), display: 'flex', alignItems: 'center', gap: 6 }}>▶ 执行 <span style={{ opacity: .7, fontSize: 11 }}>⌘↵</span></button>
              <button style={btn(c)}>执行选中</button>
              <button style={btnGhost(c)}>清空</button>
              <div style={{ flex: 1 }} />
              <span style={{ color: c.faint, fontSize: 12 }}>第 1 条语句</span>
            </div>
            {/* editor */}
            <div style={{ height: 158, display: 'flex', borderBottom: `1px solid ${c.line}`, background: c.win, flexShrink: 0 }}>
              <div style={{ width: 42, background: '#fafaf9', borderRight: `1px solid ${c.line}`, padding: '12px 0', textAlign: 'right', color: c.faint, fontFamily: c.mono, fontSize: 12.5, lineHeight: '21px' }}>
                {[1, 2, 3, 4, 5].map((n) => <div key={n} style={{ paddingRight: 10 }}>{n}</div>)}
              </div>
              <pre style={{ margin: 0, padding: '12px 14px', fontFamily: c.mono, fontSize: 13, lineHeight: '21px', flex: 1, whiteSpace: 'pre', overflow: 'hidden' }}>
                <span style={{ color: '#a626a4' }}>SELECT</span> <span style={{ color: c.dim }}>*</span>{'\n'}
                <span style={{ color: '#a626a4' }}>FROM</span> orders{'\n'}
                <span style={{ color: '#a626a4' }}>WHERE</span> status <span style={{ color: c.dim }}>=</span> <span style={{ color: '#1f7a3d' }}>'PAID'</span>{'\n'}
                <span style={{ color: '#a626a4' }}>ORDER BY</span> created_at <span style={{ color: '#a626a4' }}>DESC</span>{'\n'}
                <span style={{ color: '#a626a4' }}>LIMIT</span> <span style={{ color: '#c18401' }}>200</span>;
              </pre>
            </div>

            {/* result tabs */}
            <div style={{ height: 38, borderBottom: `1px solid ${c.line}`, display: 'flex', alignItems: 'stretch', padding: '0 4px', flexShrink: 0 }}>
              {[['result', '查询结果'], ['data', '表数据'], ['struct', '结构'], ['history', '历史']].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} style={{ border: 'none', background: 'none', padding: '0 14px', fontSize: 12.5, cursor: 'pointer', position: 'relative',
                  color: tab === k ? c.text : c.dim, fontWeight: tab === k ? 600 : 500 }}>
                  {label}
                  {tab === k && <span style={{ position: 'absolute', left: 10, right: 10, bottom: 0, height: 2, background: c.sel, borderRadius: 2 }} />}
                </button>
              ))}
            </div>

            {/* result toolbar */}
            <div style={{ height: 36, borderBottom: `1px solid ${c.line}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', flexShrink: 0, color: c.dim, fontSize: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1f7a3d' }} />成功 · <b style={{ color: c.text, fontVariantNumeric: 'tabular-nums' }}>200</b> 行 · <span style={{ fontVariantNumeric: 'tabular-nums' }}>42 ms</span></span>
              <div style={{ flex: 1 }} />
              <span>每页 <span style={{ color: c.text, fontWeight: 600 }}>200 ▾</span></span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button style={pageBtn(c)}>‹</button>
                <span style={{ padding: '0 6px', fontVariantNumeric: 'tabular-nums' }}>1 / 1</span>
                <button style={pageBtn(c)}>›</button>
              </div>
              <button style={btnGhost(c)}>复制</button>
              <button style={btnGhost(c)}>↻</button>
            </div>

            {/* grid */}
            <div style={{ flex: 1, overflow: 'hidden', background: c.win }}>
              <Grid />
            </div>
          </div>
        </div>

        {/* status bar */}
        <div style={{ height: 26, background: c.chrome, borderTop: `1px solid ${c.chromeLine}`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 14px', flexShrink: 0, fontSize: 11.5, color: c.dim }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#28c840' }} />已连接</span>
          <span>{D.connection.user}</span>
          <span>order_center</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>耗时 42 ms</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>返回 200 行</span>
        </div>
      </div>
    );

    function Grid() {
      const widths = [70, 158, 96, 104, 104, 70, 150, 118, 156];
      return (
        <div style={{ height: '100%', overflow: 'hidden', fontSize: 12.5 }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${c.line}`, background: '#fafaf9', position: 'sticky', top: 0 }}>
            <div style={{ width: 40, flexShrink: 0, padding: '7px 0', textAlign: 'center', color: c.faint, borderRight: `1px solid ${c.line}` }}>#</div>
            {D.resultCols.map((col, i) => (
              <div key={col} style={{ width: widths[i], flexShrink: 0, padding: '7px 10px', fontWeight: 600, color: c.dim, fontFamily: c.mono, fontSize: 11.5, borderRight: `1px solid ${c.line}`, display: 'flex', alignItems: 'center', gap: 5 }}>
                {col}{col === 'id' && <span style={{ fontSize: 8.5, fontWeight: 700, color: c.sel, background: c.selSoft, padding: '0px 4px', borderRadius: 3 }}>PK</span>}
              </div>
            ))}
          </div>
          {D.rows.map((r, ri) => (
            <div key={ri} style={{ display: 'flex', borderBottom: `1px solid #f1efed`, background: ri % 2 ? '#fbfbfa' : c.win }}>
              <div style={{ width: 40, flexShrink: 0, padding: '6px 0', textAlign: 'center', color: c.faint, borderRight: `1px solid ${c.line}`, fontVariantNumeric: 'tabular-nums' }}>{ri + 1}</div>
              {r.map((v, ci) => (
                <div key={ci} style={{ width: widths[ci], flexShrink: 0, padding: '6px 10px', borderRight: `1px solid #f1efed`, fontFamily: c.mono, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>
                  {D.resultCols[ci] === 'status' ? <StatusPill s={v} /> : <Cell v={v} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }
  }

  function btn(c) { return { background: c.win, border: `1px solid ${c.line}`, borderRadius: 7, padding: '5px 11px', fontSize: 12.5, color: c.text, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }; }
  function btnGhost(c) { return { background: 'none', border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 12.5, color: c.dim, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }; }
  function btnPrimary(c) { return { background: c.sel, border: 'none', borderRadius: 7, padding: '6px 13px', fontSize: 12.5, color: '#fff', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }; }
  function pageBtn(c) { return { background: c.win, border: `1px solid ${c.line}`, borderRadius: 5, width: 22, height: 22, fontSize: 12, color: c.dim, cursor: 'pointer' }; }

  window.WorkspaceV1 = WorkspaceV1;
})();
