// Shared realistic OceanBase fake data — identical across all 3 versions
// so the comparison is about design, not content.

window.OB = (function () {
  const connection = {
    name: '生产 OB · 订单中心',
    host: '10.12.34.56',
    port: 2883,
    user: 'root@mysql#obcluster',
    database: 'order_center',
    status: 'connected',
  };

  // DB tree. expanded flags drive the default mock state.
  const tree = [
    {
      db: 'order_center',
      open: true,
      tables: [
        { name: 'orders', type: 'table', active: true },
        { name: 'order_items', type: 'table' },
        { name: 'customers', type: 'table' },
        { name: 'payments', type: 'table' },
        { name: 'refunds', type: 'table' },
        { name: 'shipping_address', type: 'table' },
        { name: 'coupons', type: 'table' },
        { name: 'v_order_summary', type: 'view' },
      ],
    },
    { db: 'app_db', tables: [] },
    { db: 'analytics', tables: [] },
    { db: 'information_schema', tables: [] },
    { db: 'oceanbase', tables: [] },
  ];

  // Columns of `orders` (for structure tab)
  const columns = [
    { name: 'id', type: 'bigint(20)', nullable: false, def: null, key: 'PRI', extra: 'auto_increment' },
    { name: 'order_no', type: 'varchar(32)', nullable: false, def: null, key: 'UNI', extra: '' },
    { name: 'customer_id', type: 'bigint(20)', nullable: false, def: null, key: 'MUL', extra: '' },
    { name: 'status', type: 'varchar(16)', nullable: false, def: "'CREATED'", key: '', extra: '' },
    { name: 'total_amount', type: 'decimal(12,2)', nullable: false, def: '0.00', key: '', extra: '' },
    { name: 'currency', type: 'char(3)', nullable: false, def: "'CNY'", key: '', extra: '' },
    { name: 'remark', type: 'varchar(255)', nullable: true, def: null, key: '', extra: '' },
    { name: 'payload', type: 'blob', nullable: true, def: null, key: '', extra: '' },
    { name: 'created_at', type: 'datetime', nullable: false, def: 'CURRENT_TIMESTAMP', key: '', extra: '' },
    { name: 'updated_at', type: 'datetime', nullable: true, def: null, key: '', extra: '' },
  ];

  const resultCols = ['id', 'order_no', 'customer_id', 'status', 'total_amount', 'currency', 'remark', 'payload', 'created_at'];

  const NULL = { __null: true };
  const BLOB = (n) => ({ __blob: n });

  const rows = [
    [10241, 'OB20260605A0231', 88231, 'PAID', '1299.00', 'CNY', '加急配送', BLOB(2048), '2026-06-05 09:12:44'],
    [10242, 'OB20260605A0232', 11902, 'PAID', '459.50', 'CNY', NULL, BLOB(1536), '2026-06-05 09:13:01'],
    [10243, 'OB20260605A0233', 50118, 'REFUNDING', '88.00', 'CNY', '七天无理由', BLOB(980), '2026-06-05 09:15:22'],
    [10244, 'OB20260605A0234', 88231, 'CREATED', '2390.00', 'CNY', NULL, NULL, '2026-06-05 09:18:09'],
    [10245, 'OB20260605A0235', 33471, 'PAID', '19.90', 'CNY', '凑单', BLOB(512), '2026-06-05 09:20:55'],
    [10246, 'OB20260605A0236', 72004, 'CANCELLED', '660.00', 'CNY', '用户取消', BLOB(1280), '2026-06-05 09:21:30'],
    [10247, 'OB20260605A0237', 11902, 'PAID', '128.00', 'CNY', NULL, BLOB(740), '2026-06-05 09:24:18'],
    [10248, 'OB20260605A0238', 90562, 'PAID', '3499.00', 'CNY', '企业采购，开专票', BLOB(4096), '2026-06-05 09:27:41'],
    [10249, 'OB20260605A0239', 50118, 'SHIPPED', '215.00', 'CNY', NULL, BLOB(620), '2026-06-05 09:30:02'],
    [10250, 'OB20260605A0240', 41887, 'PAID', '78.50', 'CNY', NULL, BLOB(330), '2026-06-05 09:31:19'],
    [10251, 'OB20260605A0241', 33471, 'PAID', '1099.00', 'CNY', '生日礼物', BLOB(1700), '2026-06-05 09:33:48'],
    [10252, 'OB20260605A0242', 88231, 'CREATED', '49.00', 'CNY', NULL, NULL, '2026-06-05 09:35:12'],
    [10253, 'OB20260605A0243', 60923, 'PAID', '899.00', 'CNY', NULL, BLOB(1100), '2026-06-05 09:38:27'],
    [10254, 'OB20260605A0244', 72004, 'REFUNDING', '320.00', 'CNY', '缺货退款', BLOB(860), '2026-06-05 09:40:55'],
    [10255, 'OB20260605A0245', 11902, 'PAID', '1580.00', 'CNY', NULL, BLOB(2200), '2026-06-05 09:42:33'],
    [10256, 'OB20260605A0246', 50118, 'SHIPPED', '42.00', 'CNY', NULL, BLOB(410), '2026-06-05 09:45:01'],
    [10257, 'OB20260605A0247', 90562, 'PAID', '12999.00', 'CNY', '大客户', BLOB(5120), '2026-06-05 09:47:20'],
    [10258, 'OB20260605A0248', 41887, 'PAID', '256.00', 'CNY', NULL, BLOB(690), '2026-06-05 09:49:44'],
  ];

  const sql = "SELECT *\nFROM orders\nWHERE status = 'PAID'\nORDER BY created_at DESC\nLIMIT 200;";

  const history = [
    { sql: "SELECT * FROM orders WHERE status = 'PAID' ORDER BY created_at DESC LIMIT 200;", at: '09:51:02', ms: 42, rows: 200 },
    { sql: 'SHOW FULL COLUMNS FROM `orders`;', at: '09:48:11', ms: 11, rows: 10 },
    { sql: 'SELECT count(*) FROM order_items WHERE order_id = 10248;', at: '09:46:35', ms: 8, rows: 1 },
    { sql: 'UPDATE orders SET status = ? WHERE id = ?;', at: '09:44:50', ms: 17, rows: null, affected: 1 },
    { sql: 'SHOW TABLES;', at: '09:40:02', ms: 6, rows: 8 },
  ];

  const status = { ms: 42, rows: 200, limit: 200 };

  return { connection, tree, columns, resultCols, rows, sql, history, status, NULL, BLOB };
})();
