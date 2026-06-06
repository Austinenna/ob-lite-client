// Prototype data layer: multi-environment connections, per-DB tables,
// table schemas, and a deterministic row generator. No network — all local.
window.OBP = (function () {
  // ---- environments ----
  const ENV = {
    prod: { label: '生产', color: '#d6453d', soft: '#fdeceb', ring: '#f3b9b4' },
    dev:  { label: '开发', color: '#1f8a4d', soft: '#e7f6ec', ring: '#aedcc0' },
    test: { label: '测试', color: '#b5851a', soft: '#fbf3df', ring: '#e7cf93' },
  };

  // ---- connections (some across the same logical DB in different envs) ----
  const connections = [
    { id: 'p-order', name: '订单中心', env: 'prod', host: '10.12.34.56', port: 2883, user: 'root@mysql#obcluster', status: 'connected', primary: 'order_center', ping: 3, server: 'OB 4.2.1 · MySQL' },
    { id: 'p-user',  name: '用户中心', env: 'prod', host: '10.12.34.57', port: 2883, user: 'app@mysql#obcluster', status: 'connected', primary: 'user_center', ping: 4, server: 'OB 4.2.1 · MySQL' },
    { id: 'd-order', name: '订单中心', env: 'dev',  host: '10.0.0.21',   port: 2881, user: 'dev@mysql#obdev',    status: 'connected', primary: 'order_center', ping: 1, server: 'OB 4.2.3 · MySQL' },
    { id: 't-order', name: '订单库',   env: 'test', host: '10.0.5.9',    port: 2881, user: 'qa@mysql#obtest',    status: 'disconnected', primary: 'order_center', ping: null, server: 'OB 4.2.0 · MySQL' },
  ];

  // ---- table lists per database ----
  const tablesByDb = {
    order_center: [
      ['orders', 'table'], ['order_items', 'table'], ['customers', 'table'], ['payments', 'table'],
      ['refunds', 'table'], ['shipping_address', 'table'], ['coupons', 'table'], ['promotions', 'table'],
      ['inventory_lock', 'table'], ['v_order_summary', 'view'],
    ],
    user_center: [
      ['users', 'table'], ['user_profile', 'table'], ['roles', 'table'], ['permissions', 'table'],
      ['user_role', 'table'], ['sessions', 'table'], ['login_log', 'table'], ['v_active_users', 'view'],
    ],
    app_db: [['app_config', 'table'], ['feature_flag', 'table'], ['audit_log', 'table']],
    analytics: [['dwd_order_di', 'table'], ['dws_user_df', 'table']],
    information_schema: [],
    oceanbase: [],
  };

  // databases visible per connection (primary first, expanded)
  function databasesFor(conn) {
    if (conn.primary === 'user_center') return ['user_center', 'app_db', 'information_schema', 'oceanbase'];
    return ['order_center', 'app_db', 'analytics', 'information_schema', 'oceanbase'];
  }

  // ---- schemas ----
  const STATUS_ENUMS = {
    orders: ['PAID', 'CREATED', 'REFUNDING', 'CANCELLED', 'SHIPPED'],
    payments: ['SUCCESS', 'PENDING', 'FAILED'],
    refunds: ['DONE', 'REVIEWING', 'REJECTED'],
    users: ['ACTIVE', 'LOCKED', 'INACTIVE'],
    sessions: ['ACTIVE', 'EXPIRED'],
  };

  const schemas = {
    orders: [
      ['id', 'bigint(20)', false, null, 'PRI', 'auto_increment'],
      ['order_no', 'varchar(32)', false, null, 'UNI', ''],
      ['customer_id', 'bigint(20)', false, null, 'MUL', ''],
      ['status', 'varchar(16)', false, "'CREATED'", '', ''],
      ['total_amount', 'decimal(12,2)', false, '0.00', '', ''],
      ['currency', 'char(3)', false, "'CNY'", '', ''],
      ['remark', 'varchar(255)', true, null, '', ''],
      ['payload', 'blob', true, null, '', ''],
      ['created_at', 'datetime', false, 'CURRENT_TIMESTAMP', '', ''],
    ],
    order_items: [
      ['id', 'bigint(20)', false, null, 'PRI', 'auto_increment'],
      ['order_id', 'bigint(20)', false, null, 'MUL', ''],
      ['sku', 'varchar(40)', false, null, '', ''],
      ['title', 'varchar(120)', false, null, '', ''],
      ['qty', 'int(11)', false, '1', '', ''],
      ['price', 'decimal(10,2)', false, '0.00', '', ''],
      ['created_at', 'datetime', false, 'CURRENT_TIMESTAMP', '', ''],
    ],
    customers: [
      ['id', 'bigint(20)', false, null, 'PRI', 'auto_increment'],
      ['name', 'varchar(40)', false, null, '', ''],
      ['phone', 'varchar(20)', false, null, 'UNI', ''],
      ['level', 'varchar(12)', false, "'NORMAL'", '', ''],
      ['city', 'varchar(24)', true, null, '', ''],
      ['created_at', 'datetime', false, 'CURRENT_TIMESTAMP', '', ''],
    ],
    payments: [
      ['id', 'bigint(20)', false, null, 'PRI', 'auto_increment'],
      ['order_id', 'bigint(20)', false, null, 'MUL', ''],
      ['channel', 'varchar(16)', false, null, '', ''],
      ['amount', 'decimal(12,2)', false, '0.00', '', ''],
      ['status', 'varchar(12)', false, "'PENDING'", '', ''],
      ['paid_at', 'datetime', true, null, '', ''],
    ],
    users: [
      ['id', 'bigint(20)', false, null, 'PRI', 'auto_increment'],
      ['username', 'varchar(32)', false, null, 'UNI', ''],
      ['email', 'varchar(80)', false, null, 'UNI', ''],
      ['status', 'varchar(12)', false, "'ACTIVE'", '', ''],
      ['last_login', 'datetime', true, null, '', ''],
      ['created_at', 'datetime', false, 'CURRENT_TIMESTAMP', '', ''],
    ],
  };

  const genericSchema = [
    ['id', 'bigint(20)', false, null, 'PRI', 'auto_increment'],
    ['name', 'varchar(64)', false, null, '', ''],
    ['value', 'varchar(255)', true, null, '', ''],
    ['enabled', 'tinyint(1)', false, '1', '', ''],
    ['created_at', 'datetime', false, 'CURRENT_TIMESTAMP', '', ''],
  ];

  function schemaFor(table) {
    return (schemas[table] || genericSchema).map(([name, type, nullable, def, key, extra]) => ({ name, type, nullable, def, key, extra }));
  }
  function columnsOf(table) { return schemaFor(table).map((c) => c.name); }

  // ---- deterministic PRNG ----
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const NULL = { __null: true };
  const blob = (n) => ({ __blob: n });

  const CITIES = ['上海', '北京', '杭州', '深圳', '广州', '成都', '武汉', '南京', '苏州', '西安'];
  const NAMES = ['王','李','张','刘','陈','杨','黄','周','吴','徐'];
  const GIVEN = ['伟','芳','娜','秀英','敏','静','磊','强','军','洋'];
  const CHANNELS = ['ALIPAY', 'WECHAT', 'UNIONPAY'];
  const SKUS = ['SKU-A100','SKU-B204','SKU-C330','SKU-D451','SKU-E512','SKU-F628'];
  const TITLES = ['无线机械键盘','人体工学椅','4K 显示器','降噪耳机','USB-C 扩展坞','便携显示器'];
  const REMARKS = [NULL, '加急配送', NULL, '七天无理由', '企业采购，开专票', NULL, '生日礼物', '凑单', NULL, '用户备注：尽快发货谢谢～'];

  function genRows(table, count, seed) {
    const r = rng((seed || 1) * 7919 + hash(table));
    const out = [];
    const cols = columnsOf(table);
    for (let i = 0; i < count; i++) {
      const id = 10000 + i + 1;
      const row = cols.map((col) => valueFor(table, col, id, i, r));
      out.push(row);
    }
    return out;
  }

  function valueFor(table, col, id, i, r) {
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    if (col === 'id') return id;
    if (col === 'created_at' || col === 'paid_at' || col === 'last_login' || col === 'updated_at') {
      const mm = 5, dd = 1 + (i % 28), HH = 8 + (i % 12), MM = (i * 7) % 60, SS = (i * 13) % 60;
      if ((col === 'paid_at' || col === 'last_login') && r() < 0.12) return NULL;
      return `2026-0${mm}-${String(dd).padStart(2,'0')} ${String(HH).padStart(2,'0')}:${String(MM).padStart(2,'0')}:${String(SS).padStart(2,'0')}`;
    }
    if (col === 'status') return pick(STATUS_ENUMS[table] || ['ACTIVE', 'INACTIVE']);
    if (col === 'order_no') return 'OB20260605A' + String(200 + i).padStart(4, '0');
    if (col === 'customer_id' || col === 'order_id') return 10000 + Math.floor(r() * 900);
    if (col === 'total_amount' || col === 'amount' || col === 'price') return (Math.floor(r() * 1300000) / 100).toFixed(2);
    if (col === 'currency') return 'CNY';
    if (col === 'remark') return pick(REMARKS);
    if (col === 'payload') return r() < 0.18 ? NULL : blob(300 + Math.floor(r() * 5000));
    if (col === 'name') return pick(NAMES) + pick(GIVEN);
    if (col === 'phone') return '13' + String(Math.floor(r() * 1e9)).padStart(9, '0');
    if (col === 'level') return r() < 0.25 ? 'VIP' : 'NORMAL';
    if (col === 'city') return r() < 0.1 ? NULL : pick(CITIES);
    if (col === 'channel') return pick(CHANNELS);
    if (col === 'sku') return pick(SKUS);
    if (col === 'title') return pick(TITLES);
    if (col === 'qty') return 1 + Math.floor(r() * 5);
    if (col === 'username') return 'user_' + String(1000 + i);
    if (col === 'email') return 'user' + (1000 + i) + '@example.com';
    if (col === 'enabled') return r() < 0.8 ? 1 : 0;
    if (col === 'value') return r() < 0.08 ? NULL : 'val_' + Math.floor(r() * 9999);
    return 'row_' + id;
  }

  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

  // status pill colors (UI tier — not env)
  function statusStyle(s) {
    const m = {
      PAID: ['#1f8a4d', '#e7f6ec'], SUCCESS: ['#1f8a4d', '#e7f6ec'], DONE: ['#1f8a4d', '#e7f6ec'], ACTIVE: ['#1f8a4d', '#e7f6ec'],
      CREATED: ['#b5851a', '#fbf3df'], PENDING: ['#b5851a', '#fbf3df'], REVIEWING: ['#b5851a', '#fbf3df'],
      REFUNDING: ['#cf5a3a', '#fdeee7'], FAILED: ['#cf5a3a', '#fdeee7'], REJECTED: ['#cf5a3a', '#fdeee7'], LOCKED: ['#cf5a3a', '#fdeee7'],
      SHIPPED: ['#2f6bdd', '#eef3fd'], CANCELLED: ['#8c8d94', '#f0f0ef'], INACTIVE: ['#8c8d94', '#f0f0ef'], EXPIRED: ['#8c8d94', '#f0f0ef'], NORMAL: ['#8c8d94', '#f0f0ef'], VIP: ['#8b6fce', '#f2ecfb'],
    };
    return m[s] || null;
  }

  return { ENV, connections, tablesByDb, databasesFor, schemaFor, columnsOf, genRows, statusStyle, NULL };
})();
