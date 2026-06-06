// Tab strip (multiple open tables/queries), TableView (data + structure),
// QueryView (editor + execution states), CellDrawer + Toast.
(function () {
  const { useState, useRef, useEffect } = React;
  const OBP = window.OBP;

  // ---------------- Tab strip ----------------
  function TabStrip({ tabs, activeId, env, onActivate, onClose, onNewQuery }) {
    const T = window.T; const m = OBP.ENV[env];
    return React.createElement('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 6, overflowX: 'auto', paddingBottom: 0 } },
      tabs.map((tab) => {
        const active = tab.id === activeId;
        const isQuery = tab.type === 'query';
        return React.createElement('div', { key: tab.id, onClick: () => onActivate(tab.id),
          style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px 8px 12px', borderRadius: '11px 11px 0 0', cursor: 'pointer', flexShrink: 0, maxWidth: 220,
            background: active ? T.card : 'transparent', boxShadow: active ? '0 -1px 4px rgba(20,20,30,.05)' : 'none',
            borderTop: active ? `2px solid ${m.color}` : '2px solid transparent', position: 'relative', top: active ? 0 : 1 } },
          React.createElement('span', { style: { width: 9, height: 9, borderRadius: isQuery ? 3 : 2, background: isQuery ? '#cdb6ef' : (active ? T.blue : '#cfd0d3'), flexShrink: 0, transform: isQuery ? 'rotate(45deg)' : 'none' } }),
          React.createElement('span', { style: { fontSize: 12.5, fontWeight: active ? 600 : 500, color: active ? T.text : T.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: isQuery ? T.sans : T.mono } }, tab.label),
          React.createElement('span', { onClick: (e) => { e.stopPropagation(); onClose(tab.id); }, className: 'ob-tab-x',
            style: { width: 16, height: 16, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.faint, fontSize: 13, flexShrink: 0 } }, '×'));
      }),
      React.createElement('button', { onClick: onNewQuery, title: '新建查询',
        style: { flexShrink: 0, width: 30, height: 30, borderRadius: 9, border: 'none', background: 'transparent', color: T.dim, fontSize: 17, cursor: 'pointer', marginBottom: 1 } }, '＋')
    );
  }

  // ---------------- Table view ----------------
  function ResultMeta({ children }) {
    const T = window.T;
    return React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, color: T.dim, fontSize: 12, whiteSpace: 'nowrap' } }, children);
  }

  function Segmented({ options, value, onChange }) {
    const T = window.T;
    return React.createElement('div', { style: { display: 'flex', background: T.canvas, borderRadius: 9, padding: 2 } },
      options.map((o) => {
        const v = typeof o === 'object' ? o.v : o; const label = typeof o === 'object' ? o.label : o;
        const on = v === value;
        return React.createElement('button', { key: v, onClick: () => onChange(v),
          style: { border: 'none', borderRadius: 7, padding: '4px 11px', fontSize: 11.5, cursor: 'pointer', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
            background: on ? T.card : 'transparent', color: on ? T.text : T.faint, boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : 'none' } }, label);
      }));
  }

  function TableView({ conn, tab, onUpdateTab, onToast, onViewCell }) {
    const T = window.T;
    const schema = OBP.schemaFor(tab.table);
    const cols = schema.map((c) => c.name);
    const pkCols = new Set(schema.filter((c) => c.key === 'PRI').map((c) => c.name));
    const pageSize = tab.pageSize || 200;
    const page = tab.page || 1;
    const rows = React.useMemo(() => OBP.genRows(tab.table, pageSize, conn.id.length + page), [tab.table, pageSize, page, conn.id]);
    const sub = tab.sub || 'data';

    return React.createElement('div', { style: { flex: 1, background: T.card, borderRadius: 16, boxShadow: T.shadow, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' } },
      // header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${T.lineSoft}`, flexShrink: 0 } },
        React.createElement(Segmented, { options: [{ v: 'data', label: '数据' }, { v: 'struct', label: '结构' }], value: sub, onChange: (v) => onUpdateTab({ sub: v }) }),
        React.createElement('span', { style: { fontFamily: T.mono, fontSize: 12.5, color: T.text, fontWeight: 600 } }, tab.table),
        sub === 'data' && React.createElement(ResultMeta, null,
          React.createElement('span', { style: { color: T.faint } }, '·'), `前 ${pageSize} 行`,
          React.createElement('span', { onClick: () => onToast('SELECT count(*) … 已执行 · 12,840 行'), style: { color: T.blue, cursor: 'pointer', fontSize: 11.5, marginLeft: 2 } }, '统计行数')),
        React.createElement('div', { style: { flex: 1 } }),
        sub === 'data' && React.createElement(React.Fragment, null,
          React.createElement('span', { style: { fontSize: 11.5, color: T.faint } }, '每页'),
          React.createElement(Segmented, { options: ['100', '200', '500', '1000'], value: String(pageSize), onChange: (v) => onUpdateTab({ pageSize: +v, page: 1 }) }),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 } },
            React.createElement(PageBtn, { children: '‹', onClick: () => onUpdateTab({ page: Math.max(1, page - 1) }) }),
            React.createElement('span', { style: { fontSize: 12, color: T.dim, fontVariantNumeric: 'tabular-nums', minWidth: 30, textAlign: 'center' } }, '第 ' + page + ' 页'),
            React.createElement(PageBtn, { children: '›', onClick: () => onUpdateTab({ page: page + 1 }) })),
          React.createElement(window.Btn, { kind: 'ghost', onClick: () => onToast('已刷新 ' + tab.table) }, '↻'))
      ),
      // body
      sub === 'data'
        ? React.createElement('div', { style: { flex: 1, overflow: 'hidden' } }, React.createElement(window.DataGrid, { columns: cols, rows, pkCols, onToast, onViewCell }))
        : React.createElement(StructureView, { table: tab.table, schema, onToast })
    );
  }

  function PageBtn({ children, onClick }) {
    const T = window.T;
    return React.createElement('button', { onClick, style: { width: 26, height: 26, borderRadius: 8, border: `1px solid ${T.line}`, background: T.card, color: T.dim, cursor: 'pointer', fontSize: 13 } }, children);
  }

  function StructureView({ table, schema, onToast }) {
    const T = window.T;
    const head = ['字段', '类型', '可空', '默认值', '键', '附加'];
    const ddl = `CREATE TABLE \`${table}\` (\n` + schema.map((c) =>
      `  \`${c.name}\` ${c.type}${c.nullable ? ' NULL' : ' NOT NULL'}${c.def != null ? ' DEFAULT ' + c.def : ''}${c.extra ? ' ' + c.extra.toUpperCase() : ''}`).join(',\n')
      + (schema.some((c) => c.key === 'PRI') ? `,\n  PRIMARY KEY (\`${schema.find((c) => c.key === 'PRI').name}\`)` : '')
      + '\n) ENGINE=OceanBase DEFAULT CHARSET=utf8mb4;';
    return React.createElement('div', { style: { flex: 1, overflow: 'auto', padding: 16 } },
      // columns table
      React.createElement('div', { style: { border: `1px solid ${T.line}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 } },
        React.createElement('div', { style: { display: 'flex', background: '#fcfcfb', borderBottom: `1px solid ${T.line}`, fontSize: 11.5, fontWeight: 600, color: T.dim } },
          [220, 180, 70, 180, 80, 140].map((w, i) => React.createElement('div', { key: i, style: { width: w, padding: '8px 12px' } }, head[i]))),
        schema.map((c, i) => React.createElement('div', { key: c.name, style: { display: 'flex', borderBottom: i < schema.length - 1 ? `1px solid ${T.lineSoft}` : 'none', fontSize: 12.5, fontFamily: T.mono } },
          React.createElement('div', { style: { width: 220, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 } }, c.name, c.key === 'PRI' && React.createElement('span', { style: { fontSize: 8.5, fontWeight: 700, color: T.blue, background: T.blueSoft, padding: '1px 5px', borderRadius: 8, fontFamily: T.sans } }, 'PK'), c.key === 'UNI' && React.createElement('span', { style: { fontSize: 8.5, fontWeight: 700, color: '#8b6fce', background: '#f2ecfb', padding: '1px 5px', borderRadius: 8, fontFamily: T.sans } }, 'UNI')),
          React.createElement('div', { style: { width: 180, padding: '8px 12px', color: T.dim } }, c.type),
          React.createElement('div', { style: { width: 70, padding: '8px 12px', color: c.nullable ? T.dim : T.faint } }, c.nullable ? 'YES' : 'NO'),
          React.createElement('div', { style: { width: 180, padding: '8px 12px', color: c.def == null ? T.faint : T.text } }, c.def == null ? 'NULL' : String(c.def)),
          React.createElement('div', { style: { width: 80, padding: '8px 12px', color: T.dim } }, c.key || '—'),
          React.createElement('div', { style: { width: 140, padding: '8px 12px', color: T.dim } }, c.extra || '—')))),
      // create table
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 } },
        React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: T.faint, letterSpacing: '.04em' } }, '建表语句'),
        React.createElement(window.Btn, { kind: 'default', onClick: () => { try { navigator.clipboard.writeText(ddl); } catch (e) {} onToast('已复制建表语句'); } }, '复制 DDL')),
      React.createElement('pre', { style: { margin: 0, background: '#fbfbfa', border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, fontFamily: T.mono, fontSize: 12.5, lineHeight: 1.6, color: T.text, overflow: 'auto', whiteSpace: 'pre' } }, ddl)
    );
  }

  // ---------------- Query view ----------------
  const KW = ['SELECT', 'FROM', 'WHERE', 'ORDER', 'BY', 'GROUP', 'LIMIT', 'INSERT', 'UPDATE', 'DELETE', 'SET', 'VALUES', 'JOIN', 'ON', 'AND', 'OR', 'AS', 'DESC', 'ASC', 'INTO', 'SHOW', 'DESCRIBE', 'EXPLAIN', 'CREATE', 'TABLE', 'NULL', 'NOT', 'COUNT', 'INNER', 'LEFT'];

  function QueryView({ conn, tab, onUpdateTab, onToast, onViewCell }) {
    const T = window.T;
    const timer = useRef(null);
    const taRef = useRef(null);
    const sql = tab.sql != null ? tab.sql : "SELECT *\nFROM orders\nWHERE status = 'PAID'\nORDER BY created_at DESC\nLIMIT 200;";
    const status = tab.status || 'idle';

    const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } onUpdateTab({ status: 'cancelled' }); };

    const run = (text) => {
      const s = (text != null ? text : sql).trim();
      if (timer.current) clearTimeout(timer.current);
      onUpdateTab({ status: 'running', sql });
      const first = s.replace(/^\(*/, '').split(/\s+/)[0]?.toUpperCase() || '';
      const known = ['SELECT', 'SHOW', 'DESC', 'DESCRIBE', 'EXPLAIN', 'INSERT', 'UPDATE', 'DELETE', 'WITH', 'CREATE', 'ALTER', 'DROP'];
      const t0 = performance.now();
      const isLong = /sleep\s*\(/i.test(s);
      timer.current = setTimeout(() => {
        timer.current = null;
        const ms = Math.round(performance.now() - t0);
        if (isLong) { onUpdateTab({ status: 'timeout', ms: 30000 }); return; }
        if (!known.includes(first)) { onUpdateTab({ status: 'error', ms, error: { code: 1064, msg: `You have an error in your SQL syntax near '${s.split(/\s+/)[0] || ''}'`, zh: 'SQL 语法错误：无法识别的语句开头。请检查关键字拼写。' } }); return; }
        if (['SELECT', 'SHOW', 'DESC', 'DESCRIBE', 'EXPLAIN', 'WITH'].includes(first)) {
          const n = /limit\s+(\d+)/i.test(s) ? Math.min(+RegExp.$1, 1000) : 200;
          const rows = OBP.genRows('orders', Math.min(n, 1000), conn.id.length + 3);
          onUpdateTab({ status: 'rows', ms, rowCount: rows.length, rows, cols: OBP.columnsOf('orders') });
        } else {
          onUpdateTab({ status: 'affected', ms, affected: 1 + Math.floor(Math.random() * 6) });
        }
      }, isLong ? 2600 : 620);
    };

    // keyboard: cmd+enter run, esc cancel (only matters while focused/active tab)
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
      else if (e.key === 'Escape' && status === 'running') { e.preventDefault(); cancel(); }
    };

    // ---- layout model (persisted per query tab) ----
    const wrapRef = useRef(null), gutRef = useRef(null);
    const layout = tab.layout || 'v';        // 'v' 上下 | 'h' 并排
    const focus = tab.focus || null;          // null | 'editor' | 'results'
    const editorH = tab.editorH || 168;       // px, 上下模式编辑器高度
    const editorPct = tab.editorPct || 48;    // %, 并排模式编辑器宽度
    const lines = sql.length ? sql.split('\n') : [''];
    const card = { background: T.card, borderRadius: 16, boxShadow: T.shadow };

    const startDrag = (e) => {
      e.preventDefault();
      const wrap = wrapRef.current; if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const move = (ev) => {
        if (layout === 'v') { let h = ev.clientY - rect.top; h = Math.max(96, Math.min(rect.height - 130, h)); onUpdateTab({ editorH: h }); }
        else { let p = (ev.clientX - rect.left) / rect.width * 100; p = Math.max(24, Math.min(76, p)); onUpdateTab({ editorPct: p }); }
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      document.body.style.cursor = layout === 'v' ? 'row-resize' : 'col-resize'; document.body.style.userSelect = 'none';
    };

    const iconBtn = (glyph, title, onClick, active) => React.createElement('button', { title, onClick, style: { width: 28, height: 28, borderRadius: 8, border: `1px solid ${active ? T.blue : T.line}`, background: active ? T.blueSoft : T.card, color: active ? T.blue : T.dim, cursor: 'pointer', fontSize: 13, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } }, glyph);

    const runBtn = (small) => status === 'running'
      ? React.createElement(window.Btn, { kind: 'default', onClick: cancel, style: { color: '#cf5a3a', borderColor: '#f3c3b6' } }, '■ 取消')
      : React.createElement(window.Btn, { kind: 'primary', onClick: () => run() }, '▶ 执行', small ? null : React.createElement('span', { style: { opacity: .6, marginLeft: 2, fontSize: 11 } }, '⌘↵'));

    // ---- editor ----
    const editorHeader = React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: `1px solid ${T.lineSoft}`, flexShrink: 0, overflow: 'hidden' } },
      React.createElement('span', { style: { fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: T.faint, whiteSpace: 'nowrap' } }, 'SQL'),
      React.createElement('span', { style: { fontSize: 11, color: T.faint, fontFamily: T.mono, whiteSpace: 'nowrap' } }, lines.length + ' 行'),
      React.createElement(Segmented, { options: [{ v: 'v', label: '上下' }, { v: 'h', label: '并排' }], value: layout, onChange: (v) => onUpdateTab({ layout: v, focus: null }) }),
      iconBtn(focus === 'editor' ? '⤡' : '⤢', focus === 'editor' ? '还原拆分' : '专注编辑器', () => onUpdateTab({ focus: focus === 'editor' ? null : 'editor' }), focus === 'editor'),
      React.createElement('div', { style: { flex: 1, minWidth: 8 } }),
      layout === 'v' && React.createElement('span', { style: { fontSize: 11, color: T.faint, fontFamily: T.mono, whiteSpace: 'nowrap' } }, '⌘↵ 执行 · esc 取消'),
      React.createElement(window.Btn, { kind: 'ghost', onClick: () => onUpdateTab({ sql: '', status: 'idle' }) }, '清空'),
      React.createElement(window.Btn, { kind: 'default', onClick: () => { const ta = taRef.current; if (ta && ta.selectionStart !== ta.selectionEnd) run(sql.slice(ta.selectionStart, ta.selectionEnd)); else run(); } }, '执行选中'),
      runBtn(false));

    const editorBody = React.createElement('div', { style: { flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' } },
      React.createElement('div', { ref: gutRef, style: { width: 48, overflow: 'hidden', padding: '14px 0', textAlign: 'right', background: '#fbfbfa', borderRight: `1px solid ${T.lineSoft}`, fontFamily: T.mono, fontSize: 12.5, lineHeight: '22px', color: T.faint, flexShrink: 0, userSelect: 'none' } },
        lines.map((_, i) => React.createElement('div', { key: i, style: { padding: '0 11px' } }, i + 1))),
      React.createElement('textarea', { ref: taRef, value: sql, onChange: (e) => onUpdateTab({ sql: e.target.value }), onKeyDown: onKey, spellCheck: false,
        onScroll: (e) => { if (gutRef.current) gutRef.current.scrollTop = e.target.scrollTop; },
        style: { flex: 1, border: 'none', outline: 'none', resize: 'none', padding: '14px 16px', fontFamily: T.mono, fontSize: 13, lineHeight: '22px', color: T.text, background: T.card, height: '100%', boxSizing: 'border-box' } }));

    const editorStrip = React.createElement('div', { style: { ...card, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px' } },
      React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: T.faint, whiteSpace: 'nowrap' } }, 'SQL'),
      React.createElement('span', { style: { flex: 1, fontFamily: T.mono, fontSize: 12.5, color: T.dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 } }, sql.replace(/\s+/g, ' ').trim() || '（空）'),
      runBtn(true),
      iconBtn('⤢', '展开编辑器', () => onUpdateTab({ focus: null })));

    const vBar = (label, onExpand) => React.createElement('div', { onClick: onExpand, title: '展开', style: { ...card, flexShrink: 0, width: 46, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0', cursor: 'pointer' } },
      React.createElement('span', { style: { fontSize: 13, color: T.blue } }, '⤢'),
      React.createElement('span', { style: { writingMode: 'vertical-rl', fontSize: 12, fontWeight: 700, color: T.dim, letterSpacing: '.12em' } }, label));

    const editorCard = focus === 'results'
      ? (layout === 'v' ? editorStrip : vBar('SQL 编辑器', () => onUpdateTab({ focus: null })))
      : React.createElement('div', { style: { ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...(focus === 'editor' ? { flex: 1, minHeight: 0, minWidth: 0 } : (layout === 'v' ? { height: editorH, flexShrink: 0 } : { width: editorPct + '%', flexShrink: 0 })) } }, editorHeader, editorBody);

    // ---- results ----
    const resultsHeader = React.createElement('div', { onClick: focus === 'editor' ? () => onUpdateTab({ focus: null }) : undefined,
      style: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: focus === 'editor' ? 'none' : `1px solid ${T.lineSoft}`, flexShrink: 0, cursor: focus === 'editor' ? 'pointer' : 'default', overflow: 'hidden' } },
      React.createElement('span', { style: { fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: T.faint, whiteSpace: 'nowrap' } }, '查询结果'),
      React.createElement(StatusChip, { status, tab }),
      React.createElement('div', { style: { flex: 1, minWidth: 8 } }),
      focus !== 'editor' && status === 'rows' && React.createElement(React.Fragment, null,
        React.createElement('span', { style: { fontSize: 11.5, color: T.faint, whiteSpace: 'nowrap' } }, '最多复制 1000 行'),
        React.createElement(window.Btn, { kind: 'ghost', onClick: () => onToast('已复制全部结果（' + (tab.rowCount || 0) + ' 行）') }, '复制全部'),
        React.createElement(window.Btn, { kind: 'ghost', onClick: () => onUpdateTab({ status: 'idle' }) }, '清空')),
      focus === 'editor'
        ? iconBtn('⤢', '展开结果', () => onUpdateTab({ focus: null }))
        : iconBtn(focus === 'results' ? '⤡' : '⤢', focus === 'results' ? '还原拆分' : '专注结果', () => onUpdateTab({ focus: focus === 'results' ? null : 'results' }), focus === 'results'));

    const resultsCard = focus === 'editor'
      ? (layout === 'v' ? React.createElement('div', { style: { ...card, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }, resultsHeader) : vBar('查询结果', () => onUpdateTab({ focus: null })))
      : React.createElement('div', { style: { ...card, flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }, resultsHeader,
          React.createElement('div', { style: { flex: 1, overflow: 'hidden' } }, React.createElement(ResultBody, { status, tab, conn, onToast, onViewCell, onRun: run })));

    // ---- divider (drag to resize; double-click resets) ----
    const divider = focus === null
      ? React.createElement('div', { onPointerDown: startDrag, onDoubleClick: () => onUpdateTab({ editorH: 168, editorPct: 48 }), className: 'ob-split',
          style: { flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...(layout === 'v' ? { height: 14, width: '100%', cursor: 'row-resize' } : { width: 14, height: '100%', cursor: 'col-resize' }) } },
          React.createElement('div', { className: 'ob-split-grip', style: layout === 'v' ? { width: 38, height: 4, borderRadius: 3, background: T.line } : { width: 4, height: 38, borderRadius: 3, background: T.line } }))
      : React.createElement('div', { style: layout === 'v' ? { height: 14, flexShrink: 0 } : { width: 14, flexShrink: 0 } });

    return React.createElement('div', { ref: wrapRef, style: { flex: 1, display: 'flex', flexDirection: layout === 'v' ? 'column' : 'row', minHeight: 0, minWidth: 0 } },
      editorCard, divider, resultsCard);
  }

  function StatusChip({ status, tab }) {
    const T = window.T;
    const dot = (c) => React.createElement('span', { style: { width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 } });
    const wrap = (children) => React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.dim } }, children);
    if (status === 'idle') return wrap([dot('#cfd0d3'), '未执行']);
    if (status === 'running') return wrap([React.createElement('span', { key: 's', className: 'ob-spin', style: { width: 11, height: 11, border: `2px solid ${T.blueSoft}`, borderTopColor: T.blue, borderRadius: '50%', display: 'inline-block' } }), '执行中…']);
    if (status === 'rows') return wrap([dot('#2bb86b'), React.createElement('b', { key: 'b', style: { color: T.text, fontVariantNumeric: 'tabular-nums' } }, tab.rowCount), '行 ·', React.createElement('span', { key: 'm', style: { fontVariantNumeric: 'tabular-nums' } }, tab.ms + ' ms')]);
    if (status === 'affected') return wrap([dot('#2bb86b'), '执行成功 · 影响 ', React.createElement('b', { key: 'b', style: { color: T.text } }, tab.affected), ' 行 ·', tab.ms + ' ms']);
    if (status === 'error') return wrap([dot('#cf5a3a'), React.createElement('span', { key: 'e', style: { color: '#cf5a3a', fontWeight: 600 } }, '执行失败')]);
    if (status === 'cancelled') return wrap([dot('#b5851a'), '已取消']);
    if (status === 'timeout') return wrap([dot('#cf5a3a'), React.createElement('span', { key: 't', style: { color: '#cf5a3a', fontWeight: 600 } }, '查询超时 (30s)')]);
    return null;
  }

  function ResultBody({ status, tab, conn, onToast, onViewCell, onRun }) {
    const T = window.T;
    const empty = (icon, title, desc, extra) => React.createElement('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: T.faint, padding: 24, textAlign: 'center' } },
      React.createElement('div', { style: { fontSize: 26 } }, icon),
      React.createElement('div', { style: { fontSize: 14, fontWeight: 600, color: T.dim } }, title),
      desc && React.createElement('div', { style: { fontSize: 12.5, maxWidth: 420, lineHeight: 1.6 } }, desc), extra);

    if (status === 'idle') return empty('⌘↵', '尚未执行查询', '在上方输入 SQL，按 ⌘↵ 执行。SELECT / SHOW / EXPLAIN 返回结果表格，其它语句返回影响行数。');
    if (status === 'running') return React.createElement('div', { style: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: T.dim } },
      React.createElement('span', { className: 'ob-spin', style: { width: 16, height: 16, border: `2.5px solid ${T.blueSoft}`, borderTopColor: T.blue, borderRadius: '50%' } }), '正在执行，可按 esc 取消…');
    if (status === 'cancelled') return empty('⊘', '查询已取消', '上一次执行被手动取消。', React.createElement(window.Btn, { kind: 'default', onClick: () => onRun(), style: { marginTop: 6 } }, '重新执行'));
    if (status === 'affected') return empty('✓', '执行成功', `语句执行完成，影响 ${tab.affected} 行，耗时 ${tab.ms} ms。无结果集返回。`);
    if (status === 'timeout') return React.createElement(ErrorPanel, { code: 'TIMEOUT', msg: 'Query execution was interrupted, maximum statement execution time exceeded', zh: '查询超过 30 秒超时限制，已自动中断。建议增加 WHERE 条件或 LIMIT，或调大超时设置。', onToast });
    if (status === 'error') return React.createElement(ErrorPanel, { code: tab.error.code, msg: tab.error.msg, zh: tab.error.zh, onToast });
    if (status === 'rows') {
      if (!tab.rows || tab.rows.length === 0) return empty('∅', '执行成功，无结果', '查询正常执行，但没有返回任何行。');
      return React.createElement(window.DataGrid, { columns: tab.cols, rows: tab.rows, pkCols: new Set(['id']), onToast, onViewCell });
    }
    return null;
  }

  function ErrorPanel({ code, msg, zh, onToast }) {
    const T = window.T;
    return React.createElement('div', { style: { padding: 18 } },
      React.createElement('div', { style: { border: `1px solid #f3c3b6`, background: '#fdf4f2', borderRadius: 12, padding: 16 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 } },
          React.createElement('span', { style: { width: 20, height: 20, borderRadius: '50%', background: '#cf5a3a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 } }, '!'),
          React.createElement('span', { style: { fontWeight: 700, color: '#a73c22' } }, '执行失败'),
          React.createElement('span', { style: { fontFamily: T.mono, fontSize: 11.5, color: '#cf5a3a', background: '#fbe3dc', padding: '2px 8px', borderRadius: 6 } }, 'ERR ' + code)),
        React.createElement('div', { style: { fontSize: 13, color: T.text, lineHeight: 1.6, marginBottom: 10 } }, zh),
        React.createElement('pre', { style: { margin: 0, background: T.card, border: `1px solid ${T.line}`, borderRadius: 9, padding: 12, fontFamily: T.mono, fontSize: 12, color: T.dim, whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, msg),
        React.createElement('div', { style: { marginTop: 10 } }, React.createElement(window.Btn, { kind: 'ghost', onClick: () => { try { navigator.clipboard.writeText(msg); } catch (e) {} onToast('已复制错误信息'); }, style: { paddingLeft: 0 } }, '复制原始错误'))));
  }

  // ---------------- Cell drawer + Toast ----------------
  function CellDrawer({ cell, onClose }) {
    const T = window.T;
    if (!cell) return null;
    const v = cell.value;
    const isNull = v && v.__null, isBlob = v && v.__blob;
    const text = isNull ? 'NULL' : isBlob ? '(二进制数据，' + (v.__blob / 1024).toFixed(1) + ' KB，已省略，不直接渲染)' : String(v);
    return React.createElement('div', { style: { position: 'fixed', inset: 0, zIndex: 900, display: 'flex', justifyContent: 'flex-end' } },
      React.createElement('div', { onClick: onClose, style: { position: 'absolute', inset: 0, background: 'rgba(20,20,30,.14)' } }),
      React.createElement('div', { style: { position: 'relative', width: 380, height: '100%', background: T.card, boxShadow: '-8px 0 30px rgba(20,20,30,.16)', display: 'flex', flexDirection: 'column', animation: 'obSlide .18s ease' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: `1px solid ${T.lineSoft}` } },
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: 11, color: T.faint, fontWeight: 600, letterSpacing: '.04em' } }, '单元格内容'),
            React.createElement('div', { style: { fontFamily: T.mono, fontSize: 14, fontWeight: 600, color: T.text, marginTop: 2 } }, cell.col)),
          React.createElement('button', { onClick: onClose, style: { border: 'none', background: T.canvas, borderRadius: 9, width: 30, height: 30, cursor: 'pointer', color: T.dim, fontSize: 16 } }, '×')),
        React.createElement('div', { style: { padding: 18, flex: 1, overflow: 'auto' } },
          isBlob && React.createElement('div', { style: { display: 'inline-block', fontSize: 10, fontWeight: 700, color: '#8b6fce', background: '#f2ecfb', padding: '3px 9px', borderRadius: 8, marginBottom: 12 } }, 'BLOB · 二进制字段'),
          React.createElement('div', { style: { fontFamily: isNull || isBlob ? T.sans : T.mono, fontSize: 13, lineHeight: 1.7, color: isNull ? T.faint : T.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontStyle: isNull ? 'italic' : 'normal' } }, text),
          React.createElement('div', { style: { marginTop: 14, fontSize: 11.5, color: T.faint } }, `长度 ${isNull || isBlob ? 0 : String(v).length} 字符`)),
        React.createElement('div', { style: { padding: 14, borderTop: `1px solid ${T.lineSoft}`, display: 'flex', gap: 8 } },
          React.createElement(window.Btn, { kind: 'default', onClick: () => { try { navigator.clipboard.writeText(text); } catch (e) {} }, style: { flex: 1, justifyContent: 'center' } }, '复制内容'),
          React.createElement(window.Btn, { kind: 'primary', onClick: onClose, style: { justifyContent: 'center' } }, '关闭'))));
  }

  function Toast({ msg }) {
    const T = window.T;
    if (!msg) return null;
    return React.createElement('div', { style: { position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 1100, background: '#23262e', color: '#fff', padding: '10px 18px', borderRadius: 11, fontSize: 13, fontWeight: 500, boxShadow: '0 8px 30px rgba(0,0,0,.25)', animation: 'obIn .16s ease', display: 'flex', alignItems: 'center', gap: 9 } },
      React.createElement('span', { style: { width: 7, height: 7, borderRadius: '50%', background: '#2bb86b' } }), msg);
  }

  if (!document.getElementById('ob-views-css')) {
    const s = document.createElement('style');
    s.id = 'ob-views-css';
    s.textContent = `@keyframes ob-spin-kf{to{transform:rotate(360deg)}}.ob-spin{animation:ob-spin-kf .7s linear infinite}
      @keyframes obSlide{from{transform:translateX(30px);opacity:.4}to{transform:none;opacity:1}}
      .ob-tab-x:hover{background:${window.T.lineSoft};color:${window.T.text}!important}
      .ob-split:hover .ob-split-grip{background:${window.T.blue}}
      .ob-split:active .ob-split-grip{background:${window.T.blue}}
      textarea::placeholder{color:${window.T.faint}}`;
    document.head.appendChild(s);
  }

  Object.assign(window, { TabStrip, TableView, QueryView, CellDrawer, Toast });
})();
