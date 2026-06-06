// Shared visual theme (ported from the prototype's `T`) plus small helpers.

export const T = {
  canvas: "#f5f5f3",
  card: "#ffffff",
  text: "#1f2024",
  dim: "#71727a",
  faint: "#a3a4ab",
  line: "#ededeb",
  lineSoft: "#f3f3f1",
  blue: "#2f6bdd",
  blueSoft: "#eef3fd",
  shadow: "0 1px 2px rgba(20,20,30,.04), 0 6px 18px rgba(20,20,30,.05)",
  shadowLg: "0 8px 30px rgba(20,20,30,.16)",
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
};

export const ENV: Record<string, { label: string; color: string; soft: string; ring: string }> = {
  prod: { label: "生产", color: "#d6453d", soft: "#fdeceb", ring: "#f3b9b4" },
  dev: { label: "开发", color: "#1f8a4d", soft: "#e7f6ec", ring: "#aedcc0" },
  test: { label: "测试", color: "#b5851a", soft: "#fbf3df", ring: "#e7cf93" },
};

const COL_W: Record<string, number> = {
  id: 74, order_no: 168, customer_id: 104, order_id: 96, status: 116, total_amount: 116,
  amount: 116, price: 96, currency: 70, remark: 200, payload: 130, created_at: 168,
  paid_at: 168, last_login: 168, name: 96, phone: 138, level: 92, city: 88, channel: 104,
  sku: 110, title: 168, qty: 64, username: 110, email: 200, enabled: 84, value: 150,
};
export function colWidth(col: string): number {
  return COL_W[col] || 140;
}

const STATUS_STYLE: Record<string, [string, string]> = {
  PAID: ["#1f8a4d", "#e7f6ec"], SUCCESS: ["#1f8a4d", "#e7f6ec"], DONE: ["#1f8a4d", "#e7f6ec"], ACTIVE: ["#1f8a4d", "#e7f6ec"],
  CREATED: ["#b5851a", "#fbf3df"], PENDING: ["#b5851a", "#fbf3df"], REVIEWING: ["#b5851a", "#fbf3df"],
  REFUNDING: ["#cf5a3a", "#fdeee7"], FAILED: ["#cf5a3a", "#fdeee7"], REJECTED: ["#cf5a3a", "#fdeee7"], LOCKED: ["#cf5a3a", "#fdeee7"],
  SHIPPED: ["#2f6bdd", "#eef3fd"], CANCELLED: ["#8c8d94", "#f0f0ef"], INACTIVE: ["#8c8d94", "#f0f0ef"],
  EXPIRED: ["#8c8d94", "#f0f0ef"], NORMAL: ["#8c8d94", "#f0f0ef"], VIP: ["#8b6fce", "#f2ecfb"],
};
export function statusStyle(s: string): [string, string] | null {
  return STATUS_STYLE[s] || null;
}
