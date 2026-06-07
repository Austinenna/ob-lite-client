// Shapes mirroring the Rust backend's serde output (camelCase).

export type Cell = string | { __null: true } | { __blob: number };

export interface ColumnMeta {
  name: string;
  type: string;
  nullable: boolean;
  def: string | null;
  key: string; // "" | "PRI" | "UNI" | "MUL"
  extra: string;
}

export interface QueryResult {
  kind: "rows" | "affected";
  columns?: ColumnMeta[];
  rows?: Cell[][];
  rowCount?: number;
  affected?: number;
  lastInsertId?: number;
  durationMs: number;
  truncated: boolean;
  hasMore: boolean;
}

export interface TableInfo {
  name: string;
  type: "table" | "view";
}

export type Env = "prod" | "dev" | "test";

export interface ConnectionConfig {
  id: string;
  name: string;
  env: Env;
  host: string;
  port: number;
  user: string;
  database?: string | null;
  sslEnabled: boolean;
  primary?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface TestResult {
  server: string;
  pingMs: number;
}

export interface HistoryEntry {
  id: string;
  connId: string;
  database: string | null;
  sql: string;
  status: string;
  durationMs: number | null;
  rowCount: number | null;
  affected: number | null;
  error: string | null;
  executedAt: number;
}

export interface Favorite {
  id: string;
  name: string;
  sql: string;
  connId?: string | null;
  createdAt: number;
}

/** Error payload returned by every failing command. */
export interface AppError {
  code: string;
  msg: string;
  zh: string;
}

export function isAppError(e: unknown): e is AppError {
  return !!e && typeof e === "object" && "zh" in e && "msg" in e;
}

// ---- frontend-only workspace model ----

export type ConnStatus = "connected" | "disconnected" | "connecting";

export interface TableTab {
  id: string;
  type: "table";
  db: string;
  table: string;
  label: string;
  pageSize: number;
  page: number;
  sub: "data" | "struct";
  where?: string;
}

export interface QueryTab {
  id: string;
  type: "query";
  label: string;
  sql: string;
  status: "idle" | "running" | "cancelling" | "rows" | "affected" | "error" | "cancelled" | "timeout";
  layout?: "v" | "h";
  focus?: "editor" | "results" | null;
  editorH?: number;
  editorPct?: number;
  // last execution
  result?: QueryResult;
  error?: AppError;
  queryId?: string;
  executedSql?: string; // the SQL of the last run, reused when paging
}

export type Tab = TableTab | QueryTab;

export interface Workspace {
  filter: string;
  activeTabId: string | null;
  tabs: Tab[];
}
