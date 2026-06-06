// Shared V3 theme + interactive DataGrid (cell select, right-click context
// menu: copy cell / copy row / view full content) + small UI helpers.
(function () {
  const { useState, useRef, useEffect } = React;

  const T = {
    canvas: '#f5f5f3', card: '#ffffff', text: '#1f2024', dim: '#71727a', faint: '#a3a4ab',
    line: '#ededeb', lineSoft: '#f3f3f1', blue: '#2f6bdd', blueSoft: '#eef3fd',
    shadow: '0 1px 2px rgba(20,20,30,.04), 0 6px 18px rgba(20,20,30,.05)',
    shadowLg: '0 8px 30px rgba(20,20,30,.16)',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  };
  window.T = T;

  function colWidth(col) {
    const w = { id: 74, order_no: 168, customer_id: 104, order_id: 96, status: 116, total_amount: 116, amount: 116,
      price: 96, currency: 70, remark: 200, payload: 130, created_at: 168, paid_at: 168, last_login: 168,
      name: 96, phone: 138, level: 92, city: 88, channel: 104, sku: 110, title: 168, qty: 64, username: 110,
      email: 200, enabled: 84, value: 150 };
    return w[col] || 130;
  }

  function fmtVal(v) {
    if (v && v.__null) return 'NULL';
    if (v && v.__blob) return '‹blob ' + (v.__blob / 1024).toFixed(1) + ' KB›';
    return String(v);
  }

  function Cell({ v }) {
    if (v && v.__null) return React.createElement('span', { style: { color: T.faint, fontSize: 11, fontWeight: 600, letterSpacing: '.03em' } }, 'null');
    if (v && v.__blob) return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, color: T.dim } },
      React.createElement('span', { style: { fontSize: 9.5, fontWeight: 700, color: '#8b6fce', background: '#f2ecfb', padding: '1px 6px', borderRadius: 10 } }, 'BLOB'),
      (v.__blob / 1024).toFixed(1) + ' KB');
    return React.createElement('span', null, String(v));
  }

  function StatusPill({ s }) {
    const st = window.OBP.statusStyle(s);
    if (!st) return React.createElement('span', null, s);
    return React.createElement('span', { style: { color: st[0], background: st[1], fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' } }, s);
  }

  // columns: [names]; rows: [[...]]; pkCols: Set of pk col names; onToast, onViewCell
  function DataGrid({ columns, rows, pkCols, onToast, onViewCell }) {
    const [sel, setSel] = useState(null); // {r,c}
    const [menu, setMenu] = useState(null); // {x,y,r,c}
    useEffect(() => {
      if (!menu) return;
      const close = () => setMenu(null);
      window.addEventListener('click', close);
      window.addEventListener('scroll', close, true);
      return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
    }, [menu]);

    const copy = (txt, label) => {
      try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch (e) {}
      onToast && onToast(label);
      setMenu(null);
    };
    const ctx = (e, r, c) => { e.preventDefault(); setSel({ r, c }); setMenu({ x: e.clientX, y: e.clientY, r, c }); };

    return React.createElement('div', { style: { position: 'relative', height: '100%', overflow: 'auto', fontSize: 12.5 } },
      React.createElement('div', { style: { minWidth: 'max-content' } },
        // header
        React.createElement('div', { style: { display: 'flex', borderBottom: `1px solid ${T.line}`, background: '#fcfcfb', position: 'sticky', top: 0, zIndex: 1 } },
          React.createElement('div', { style: { width: 46, flexShrink: 0, padding: '9px 0', textAlign: 'center', color: T.faint, position: 'sticky', left: 0, background: '#fcfcfb', borderRight: `1px solid ${T.lineSoft}` } }, '#'),
          columns.map((col) => React.createElement('div', { key: col, style: { width: colWidth(col), flexShrink: 0, padding: '9px 12px', fontWeight: 600, color: T.dim, fontSize: 11.5, display: 'flex', gap: 5, alignItems: 'center', fontFamily: T.mono } },
            col, pkCols && pkCols.has(col) && React.createElement('span', { style: { fontSize: 8.5, fontWeight: 700, color: T.blue, background: T.blueSoft, padding: '1px 5px', borderRadius: 8, fontFamily: T.sans } }, 'PK')))
        ),
        // rows
        rows.map((row, ri) => React.createElement('div', { key: ri, style: { display: 'flex', borderBottom: `1px solid ${T.lineSoft}`, background: sel && sel.r === ri ? '#fafbff' : 'transparent' } },
          React.createElement('div', { style: { width: 46, flexShrink: 0, padding: '8px 0', textAlign: 'center', color: T.faint, fontVariantNumeric: 'tabular-nums', position: 'sticky', left: 0, background: sel && sel.r === ri ? '#fafbff' : T.card, borderRight: `1px solid ${T.lineSoft}` } }, ri + 1),
          row.map((v, ci) => {
            const isStatus = columns[ci] === 'status' || columns[ci] === 'level';
            const selected = sel && sel.r === ri && sel.c === ci;
            return React.createElement('div', {
              key: ci,
              onClick: () => setSel({ r: ri, c: ci }),
              onDoubleClick: () => onViewCell && onViewCell({ col: columns[ci], value: v, row }),
              onContextMenu: (e) => ctx(e, ri, ci),
              style: { width: colWidth(columns[ci]), flexShrink: 0, padding: '8px 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                fontFamily: isStatus ? T.sans : T.mono, fontSize: 12, fontVariantNumeric: 'tabular-nums', cursor: 'default',
                boxShadow: selected ? `inset 0 0 0 2px ${T.blue}` : 'none', borderRadius: selected ? 4 : 0 },
            }, isStatus ? React.createElement(StatusPill, { s: v }) : React.createElement(Cell, { v }));
          })
        ))
      ),
      // context menu
      menu && React.createElement('div', { style: { position: 'fixed', left: Math.min(menu.x, window.innerWidth - 180), top: menu.y, zIndex: 1000, background: T.card, borderRadius: 10, boxShadow: T.shadowLg, border: `1px solid ${T.line}`, padding: 5, minWidth: 168, fontSize: 12.5 } },
        [
          ['复制单元格', () => copy(fmtVal(rows[menu.r][menu.c]), '已复制单元格')],
          ['复制整行', () => copy(rows[menu.r].map(fmtVal).join('\t'), '已复制整行')],
          ['复制列名+值', () => copy(columns[menu.c] + ' = ' + fmtVal(rows[menu.r][menu.c]), '已复制')],
          ['__sep'],
          ['查看完整内容', () => { onViewCell && onViewCell({ col: columns[menu.c], value: rows[menu.r][menu.c], row: rows[menu.r] }); setMenu(null); }],
        ].map((item, i) => item[0] === '__sep'
          ? React.createElement('div', { key: i, style: { height: 1, background: T.lineSoft, margin: '4px 6px' } })
          : React.createElement('div', { key: i, onClick: item[1], className: 'ob-menu-item', style: { padding: '7px 10px', borderRadius: 7, cursor: 'pointer', color: T.text } }, item[0]))
      )
    );
  }

  // small helpers
  function Btn({ kind, children, onClick, style }) {
    const base = { borderRadius: 10, fontSize: 12.5, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'background .12s' };
    const variants = {
      primary: { background: T.blue, border: 'none', padding: '7px 15px', color: '#fff' },
      default: { background: T.card, border: `1px solid ${T.line}`, padding: '6px 13px', color: T.text },
      ghost: { background: 'none', border: 'none', padding: '6px 11px', color: T.dim, fontWeight: 500 },
    };
    return React.createElement('button', { onClick, style: { ...base, ...(variants[kind] || variants.default), ...style } }, children);
  }

  if (!document.getElementById('ob-proto-css')) {
    const s = document.createElement('style');
    s.id = 'ob-proto-css';
    s.textContent = `
      .ob-menu-item:hover{background:${T.blueSoft};color:${T.blue}}
      *{scrollbar-width:thin;scrollbar-color:#d4d4d0 transparent}
      *::-webkit-scrollbar{width:9px;height:9px}
      *::-webkit-scrollbar-thumb{background:#d4d4d0;border-radius:6px;border:2px solid #fff}
      *::-webkit-scrollbar-track{background:transparent}
      button:active{transform:translateY(.5px)}
      @keyframes obIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    `;
    document.head.appendChild(s);
  }

  Object.assign(window, { DataGrid, Cell, StatusPill, Btn, fmtVal, colWidth });
})();
