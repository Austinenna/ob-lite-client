// V3 — Modern minimal SaaS. Soft off-white canvas, floating white rounded
// cards, pill tabs, generous spacing, friendly. Same data, breathable layout.
(function () {
  const { useState } = React;
  const D = window.OB;

  const c = {
    canvas: '#f5f5f3',
    card: '#ffffff',
    text: '#1f2024',
    dim: '#71727a',
    faint: '#a3a4ab',
    line: '#ededeb',
    lineSoft: '#f3f3f1',
    blue: '#2f6bdd',
    blueSoft: '#eef3fd',
    shadow: '0 1px 2px rgba(20,20,30,.04), 0 6px 18px rgba(20,20,30,.05)',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  };

  function Cell({ v }) {
    if (v && v.__null) return <span style={{ color: c.faint, fontSize: 11, fontWeight: 600, letterSpacing: '.03em' }}>null</span>;
    if (v && v.__blob) return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: c.dim }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: '#8b6fce', background: '#f2ecfb', padding: '1px 6px', borderRadius: 10 }}>BLOB</span>
        {(v.__blob / 1024).toFixed(1)} KB
      </span>
    );
    return <span>{String(v)}</span>;
  }
  function Status({ s }) {
    const map = { PAID: ['#1f8a4d', '#e7f6ec'], CREATED: ['#b5851a', '#fbf3df'], REFUNDING: ['#cf5a3a', '#fdeee7'], CANCELLED: ['#8c8d94', '#f0f0ef'], SHIPPED: ['#2f6bdd', '#eef3fd'] };
    const [fg, bg] = map[s] || ['#71727a', '#f0f0ef'];
    return <span style={{ color: fg, background: bg, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{s}</span>;
  }

  function WorkspaceV3() {
    const [tab, setTab] = useState('result');
    const [page, setPage] = useState('200');
    const widths = [62, 162, 100, 110, 110, 70, 150, 124];
    return (
      <div style={{ width: '100%', height: '100%', background: c.canvas, fontFamily: c.sans, color: c.text, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontSize: 13 }}>
        {/* header */}
        <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 7 }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((x) => <span key={x} style={{ width: 11, height: 11, borderRadius: '50%', background: x }} />)}
          </div>
          <div style={{ width: 1, height: 18, background: c.line }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: c.card, borderRadius: 22, padding: '6px 14px', boxShadow: c.shadow }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2bb86b' }} />
            <span style={{ fontWeight: 600 }}>{D.connection.name}</span>
            <span style={{ color: c.faint, fontFamily: c.mono, fontSize: 11.5 }}>{D.connection.host}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: c.dim, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>order_center</span>
            <span style={{ color: c.faint }}>›</span>
            <span style={{ background: c.blueSoft, color: c.blue, fontWeight: 600, padding: '3px 10px', borderRadius: 16 }}>orders</span>
          </div>
          <div style={{ flex: 1 }} />
          <button style={{ ...iconBtn(c) }}>↻</button>
        </div>

        {/* body */}
        <div style={{ flex: 1, display: 'flex', gap: 14, padding: '0 14px 14px', minHeight: 0 }}>
          {/* sidebar card */}
          <div style={{ width: 236, background: c.card, borderRadius: 16, boxShadow: c.shadow, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
            <div style={{ padding: 14 }}>
              <div style={{ background: c.canvas, borderRadius: 11, padding: '8px 12px', color: c.faint, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span>⌕</span>筛选表…
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', padding: '0 8px' }}>
              {D.tree.map((node) => (
                <div key={node.db} style={{ marginBottom: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10, fontWeight: node.open ? 600 : 500, color: node.open ? c.text : c.dim }}>
                    <span style={{ width: 10, fontSize: 9, color: c.faint }}>{node.open ? '▾' : '▸'}</span>
                    <span style={{ width: 16, height: 16, borderRadius: 5, background: node.open ? c.blue : '#d7d8da', flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5 }}>{node.db}</span>
                  </div>
                  {node.open && node.tables.map((t) => (
                    <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 10px 6px 32px', borderRadius: 10, marginBottom: 1,
                      background: t.active ? c.blueSoft : 'transparent', color: t.active ? c.blue : c.dim, fontWeight: t.active ? 600 : 400, fontSize: 12.5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: t.type === 'view' ? '#cdb6ef' : (t.active ? c.blue : '#cfd0d3'), flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* main column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            {/* editor card */}
            <div style={{ background: c.card, borderRadius: 16, boxShadow: c.shadow, flexShrink: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${c.lineSoft}` }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: c.faint, whiteSpace: 'nowrap' }}>SQL 编辑器</span>
                <div style={{ flex: 1 }} />
                <button style={btnGhost(c)}>清空</button>
                <button style={btn(c)}>运行选中</button>
                <button style={btnPrimary(c)}>运行<span style={{ opacity: .65, marginLeft: 6, fontSize: 11 }}>⌘↵</span></button>
              </div>
              <pre style={{ margin: 0, padding: '16px 18px', fontFamily: c.mono, fontSize: 13, lineHeight: '22px', whiteSpace: 'pre' }}>
                <span style={{ color: '#2f6bdd', fontWeight: 600 }}>SELECT</span> *{'\n'}
                <span style={{ color: '#2f6bdd', fontWeight: 600 }}>FROM</span> orders{'\n'}
                <span style={{ color: '#2f6bdd', fontWeight: 600 }}>WHERE</span> status <span style={{ color: c.dim }}>=</span> <span style={{ color: '#1f8a4d' }}>'PAID'</span>{'\n'}
                <span style={{ color: '#2f6bdd', fontWeight: 600 }}>ORDER BY</span> created_at <span style={{ color: '#2f6bdd', fontWeight: 600 }}>DESC</span> <span style={{ color: '#2f6bdd', fontWeight: 600 }}>LIMIT</span> <span style={{ color: '#b5851a' }}>200</span>;
              </pre>
            </div>

            {/* results card */}
            <div style={{ flex: 1, background: c.card, borderRadius: 16, boxShadow: c.shadow, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${c.lineSoft}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', background: c.canvas, borderRadius: 11, padding: 3, gap: 2 }}>
                  {[['result', '结果'], ['data', '表数据'], ['struct', '结构'], ['history', '历史']].map(([k, label]) => (
                    <button key={k} onClick={() => setTab(k)} style={{ border: 'none', borderRadius: 9, padding: '5px 13px', fontSize: 12.5, cursor: 'pointer', fontWeight: 600,
                      background: tab === k ? c.card : 'transparent', color: tab === k ? c.text : c.dim, boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>{label}</button>
                  ))}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: c.dim, fontSize: 12, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2bb86b' }} />
                  <b style={{ color: c.text, fontVariantNumeric: 'tabular-nums' }}>200</b> 行 · <span style={{ fontVariantNumeric: 'tabular-nums' }}>42 ms</span>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', background: c.canvas, borderRadius: 9, padding: 2 }}>
                  {['100', '200', '500'].map((p) => (
                    <button key={p} onClick={() => setPage(p)} style={{ border: 'none', borderRadius: 7, padding: '4px 9px', fontSize: 11.5, cursor: 'pointer', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                      background: page === p ? c.card : 'transparent', color: page === p ? c.text : c.faint, boxShadow: page === p ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}>{p}</button>
                  ))}
                </div>
                <button style={iconBtn(c)}>⧉</button>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12.5 }}>
                  <div style={{ display: 'flex', borderBottom: `1px solid ${c.line}`, background: '#fcfcfb' }}>
                    <div style={{ width: 44, flexShrink: 0, padding: '9px 0', textAlign: 'center', color: c.faint }}>#</div>
                    {D.resultCols.slice(0, 8).map((col, i) => (
                      <div key={col} style={{ width: widths[i], flexShrink: 0, padding: '9px 12px', fontWeight: 600, color: c.dim, fontSize: 11.5, display: 'flex', gap: 5, alignItems: 'center' }}>
                        {col}{col === 'id' && <span style={{ fontSize: 8.5, fontWeight: 700, color: c.blue, background: c.blueSoft, padding: '1px 5px', borderRadius: 8 }}>PK</span>}
                      </div>
                    ))}
                  </div>
                  {D.rows.map((r, ri) => (
                    <div key={ri} style={{ display: 'flex', borderBottom: `1px solid ${c.lineSoft}` }}>
                      <div style={{ width: 44, flexShrink: 0, padding: '8px 0', textAlign: 'center', color: c.faint, fontVariantNumeric: 'tabular-nums' }}>{ri + 1}</div>
                      {r.slice(0, 8).map((v, ci) => (
                        <div key={ci} style={{ width: widths[ci], flexShrink: 0, padding: '8px 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          fontFamily: D.resultCols[ci] === 'status' ? c.sans : c.mono, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                          {D.resultCols[ci] === 'status' ? <Status s={v} /> : <Cell v={v} />}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function btn(c) { return { background: c.card, border: `1px solid ${c.line}`, borderRadius: 10, padding: '6px 13px', fontSize: 12.5, color: c.text, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }; }
  function btnGhost(c) { return { background: 'none', border: 'none', borderRadius: 10, padding: '6px 11px', fontSize: 12.5, color: c.dim, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }; }
  function btnPrimary(c) { return { background: c.blue, border: 'none', borderRadius: 10, padding: '7px 16px', fontSize: 12.5, color: '#fff', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }; }
  function iconBtn(c) { return { background: c.card, border: `1px solid ${c.line}`, borderRadius: 10, width: 32, height: 32, fontSize: 14, color: c.dim, cursor: 'pointer' }; }

  window.WorkspaceV3 = WorkspaceV3;
})();
