// Sidebar (live table filter + DB tree) and ConnectionSwitcher (multi-env).
(function () {
  const { useState, useMemo, useRef, useEffect } = React;
  const OBP = window.OBP;

  function hi(text, q) {
    if (!q) return text;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text;
    const T = window.T;
    return React.createElement(React.Fragment, null,
      text.slice(0, i),
      React.createElement('mark', { style: { background: '#fff2b0', color: 'inherit', padding: 0, borderRadius: 2 } }, text.slice(i, i + q.length)),
      text.slice(i + q.length));
  }

  function Sidebar({ conn, filter, onFilter, onOpenTable, activeKey }) {
    const T = window.T;
    const dbs = OBP.databasesFor(conn);
    const [open, setOpen] = useState(() => ({ [conn.primary]: true }));
    // when connection changes, reset expansion to its primary
    useEffect(() => { setOpen({ [conn.primary]: true }); }, [conn.id]);

    const q = filter.trim();
    const matchCount = useMemo(() => {
      if (!q) return null;
      let n = 0;
      dbs.forEach((db) => (OBP.tablesByDb[db] || []).forEach(([t]) => { if (t.toLowerCase().includes(q.toLowerCase())) n++; }));
      return n;
    }, [q, conn.id]);

    const toggle = (db) => setOpen((o) => ({ ...o, [db]: !o[db] }));

    return React.createElement('div', { style: { width: 248, background: T.card, borderRadius: 16, boxShadow: T.shadow, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' } },
      // filter
      React.createElement('div', { style: { padding: 12, borderBottom: `1px solid ${T.lineSoft}` } },
        React.createElement('div', { style: { background: T.canvas, borderRadius: 11, padding: '8px 11px', display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('span', { style: { color: T.faint, fontSize: 13 } }, '⌕'),
          React.createElement('input', {
            value: filter, onChange: (e) => onFilter(e.target.value), placeholder: '筛选表名…',
            style: { border: 'none', outline: 'none', background: 'none', flex: 1, fontSize: 12.5, color: T.text, fontFamily: T.sans, minWidth: 0 },
          }),
          filter && React.createElement('span', { onClick: () => onFilter(''), style: { color: T.faint, cursor: 'pointer', fontSize: 14, lineHeight: 1 } }, '×')),
        q && React.createElement('div', { style: { fontSize: 11, color: T.faint, marginTop: 7, paddingLeft: 2 } }, `匹配 ${matchCount} 张表`)
      ),
      // tree
      React.createElement('div', { style: { flex: 1, overflow: 'auto', padding: 8 } },
        dbs.map((db) => {
          const tables = OBP.tablesByDb[db] || [];
          const filtered = q ? tables.filter(([t]) => t.toLowerCase().includes(q.toLowerCase())) : tables;
          const isOpen = q ? filtered.length > 0 : !!open[db];
          if (q && filtered.length === 0) return null;
          const isPrimary = db === conn.primary;
          return React.createElement('div', { key: db, style: { marginBottom: 2 } },
            React.createElement('div', { onClick: () => !q && toggle(db), style: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10, cursor: q ? 'default' : 'pointer', fontWeight: isPrimary ? 600 : 500, color: isPrimary ? T.text : T.dim } },
              React.createElement('span', { style: { width: 10, fontSize: 9, color: T.faint } }, isOpen ? '▾' : '▸'),
              React.createElement('span', { style: { width: 16, height: 16, borderRadius: 5, background: isPrimary ? T.blue : '#d7d8da', flexShrink: 0 } }),
              React.createElement('span', { style: { fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, db),
              isPrimary && React.createElement('span', { style: { fontSize: 9.5, color: T.faint, marginLeft: 'auto' } }, '默认')),
            isOpen && (filtered.length ? filtered.map(([t, type]) => {
              const key = conn.id + '/' + db + '/' + t;
              const active = key === activeKey;
              return React.createElement('div', { key: t, onClick: () => onOpenTable(db, t, type), title: t,
                style: { display: 'flex', alignItems: 'center', gap: 9, padding: '6px 10px 6px 32px', borderRadius: 10, marginBottom: 1, cursor: 'pointer',
                  background: active ? T.blueSoft : 'transparent', color: active ? T.blue : T.dim, fontWeight: active ? 600 : 400, fontSize: 12.5 } },
                React.createElement('span', { style: { width: 9, height: 9, borderRadius: 3, background: type === 'view' ? '#cdb6ef' : (active ? T.blue : '#cfd0d3'), flexShrink: 0 } }),
                React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, hi(t, q)),
                type === 'view' && React.createElement('span', { style: { fontSize: 9, color: T.faint, marginLeft: 'auto' } }, '视图'));
            }) : (!q && React.createElement('div', { style: { padding: '4px 10px 6px 32px', fontSize: 11.5, color: T.faint } }, '（展开以加载）')))
          );
        }),
        q && matchCount === 0 && React.createElement('div', { style: { padding: 20, textAlign: 'center', color: T.faint, fontSize: 12.5 } }, `没有匹配 “${q}” 的表`)
      )
    );
  }

  // ---------- Connection switcher ----------
  function EnvBadge({ env, size }) {
    const T = window.T; const m = OBP.ENV[env];
    return React.createElement('span', { style: { fontSize: size === 'sm' ? 10 : 11, fontWeight: 700, color: m.color, background: m.soft, padding: size === 'sm' ? '1px 6px' : '2px 8px', borderRadius: 6, whiteSpace: 'nowrap', letterSpacing: '.02em' } }, m.label);
  }
  window.EnvBadge = EnvBadge;

  function ConnectionSwitcher({ conn, onSwitch, onManage }) {
    const T = window.T;
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      if (!open) return;
      const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      window.addEventListener('mousedown', h);
      return () => window.removeEventListener('mousedown', h);
    }, [open]);
    const m = OBP.ENV[conn.env];
    const grouped = ['prod', 'dev', 'test'].map((e) => [e, OBP.connections.filter((c) => c.env === e)]);

    return React.createElement('div', { ref, style: { position: 'relative' } },
      React.createElement('button', { onClick: () => setOpen((o) => !o),
        style: { display: 'flex', alignItems: 'center', gap: 9, background: T.card, borderRadius: 22, padding: '6px 8px 6px 6px', boxShadow: T.shadow, border: `1px solid ${conn.env === 'prod' ? m.ring : T.line}`, cursor: 'pointer', fontFamily: T.sans } },
        React.createElement('span', { style: { width: 9, height: 9, borderRadius: '50%', background: conn.status === 'connected' ? '#2bb86b' : '#cfd0d3', flexShrink: 0, marginLeft: 4 } }),
        React.createElement(EnvBadge, { env: conn.env }),
        React.createElement('span', { style: { fontWeight: 600, color: T.text, fontSize: 13, whiteSpace: 'nowrap' } }, conn.name),
        React.createElement('span', { style: { color: T.faint, fontFamily: T.mono, fontSize: 11.5, whiteSpace: 'nowrap' } }, conn.host),
        React.createElement('span', { style: { color: T.faint, fontSize: 10, marginRight: 4 } }, '▾')),
      open && React.createElement('div', { style: { position: 'absolute', top: '100%', left: 0, marginTop: 8, width: 320, background: T.card, borderRadius: 14, boxShadow: T.shadowLg, border: `1px solid ${T.line}`, padding: 8, zIndex: 500, animation: 'obIn .14s ease' } },
        grouped.map(([env, conns]) => React.createElement('div', { key: env, style: { marginBottom: 4 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px 4px' } },
            React.createElement(EnvBadge, { env }),
            React.createElement('span', { style: { fontSize: 10.5, color: T.faint } }, `${conns.length} 个连接`)),
          conns.map((c) => {
            const active = c.id === conn.id;
            return React.createElement('div', { key: c.id, onClick: () => { onSwitch(c.id); setOpen(false); },
              style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 9px', borderRadius: 10, cursor: 'pointer', background: active ? T.blueSoft : 'transparent' },
              onMouseEnter: (e) => { if (!active) e.currentTarget.style.background = T.canvas; },
              onMouseLeave: (e) => { if (!active) e.currentTarget.style.background = 'transparent'; } },
              React.createElement('span', { style: { width: 8, height: 8, borderRadius: '50%', background: c.status === 'connected' ? '#2bb86b' : '#cfd0d3', flexShrink: 0 } }),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { fontSize: 13, fontWeight: active ? 600 : 500, color: active ? T.blue : T.text } }, c.name),
                React.createElement('div', { style: { fontSize: 11, color: T.faint, fontFamily: T.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, `${c.user} · ${c.host}:${c.port}`)),
              active ? React.createElement('span', { style: { color: T.blue, fontWeight: 700 } }, '✓')
                : (c.status !== 'connected' && React.createElement('span', { style: { fontSize: 11, color: T.dim, border: `1px solid ${T.line}`, borderRadius: 7, padding: '3px 9px' } }, '连接')));
          })
        )),
        React.createElement('div', { style: { height: 1, background: T.lineSoft, margin: '6px 6px' } }),
        React.createElement('div', { onClick: onManage, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 9px', borderRadius: 10, cursor: 'pointer', color: T.dim, fontSize: 12.5 },
          onMouseEnter: (e) => e.currentTarget.style.background = T.canvas, onMouseLeave: (e) => e.currentTarget.style.background = 'transparent' },
          React.createElement('span', { style: { fontSize: 14 } }, '＋'), '新建连接 / 管理连接…')
      )
    );
  }

  Object.assign(window, { Sidebar, ConnectionSwitcher });
})();
