// Typed wrappers over Tauri commands. Tauri maps camelCase JS arg keys to the
// snake_case Rust parameter names automatically.
import { invoke } from "@tauri-apps/api/core";
import {
  ConnectionConfig,
  ColumnMeta,
  Favorite,
  HistoryEntry,
  QueryResult,
  TableInfo,
  TestResult,
} from "./types";

export const api = {
  // connections
  listConnections: () => invoke<ConnectionConfig[]>("list_connections"),
  saveConnection: (cfg: ConnectionConfig, password?: string) =>
    invoke<ConnectionConfig>("save_connection", { cfg, password }),
  deleteConnection: (id: string) => invoke<void>("delete_connection", { id }),
  testConnection: (cfg: ConnectionConfig, password: string) =>
    invoke<TestResult>("test_connection", { cfg, password }),
  openConnection: (id: string) => invoke<TestResult>("open_connection", { id }),
  closeConnection: (id: string) => invoke<void>("close_connection", { id }),

  // browse
  listDatabases: (id: string) => invoke<string[]>("list_databases", { id }),
  listTables: (id: string, db: string) => invoke<TableInfo[]>("list_tables", { id, db }),
  listColumns: (id: string, db: string, table: string) =>
    invoke<ColumnMeta[]>("list_columns", { id, db, table }),
  listIndexes: (id: string, db: string, table: string) =>
    invoke<QueryResult>("list_indexes", { id, db, table }),
  getCreateTable: (id: string, db: string, table: string) =>
    invoke<string>("get_create_table", { id, db, table }),

  // query
  queryTable: (args: {
    id: string;
    db: string;
    table: string;
    page: number;
    pageSize: number;
    whereClause?: string;
    orderBy?: string;
  }) => invoke<QueryResult>("query_table", args),
  countTable: (id: string, db: string, table: string, whereClause?: string) =>
    invoke<number>("count_table", { id, db, table, whereClause }),
  executeSql: (args: {
    id: string;
    sql: string;
    queryId: string;
    database?: string;
    page?: number;
    pageSize?: number;
    timeoutSecs?: number;
  }) => invoke<QueryResult>("execute_sql", args),
  cancelQuery: (queryId: string) => invoke<void>("cancel_query", { queryId }),

  // history & favorites
  listHistory: () => invoke<HistoryEntry[]>("list_history"),
  clearHistory: () => invoke<void>("clear_history"),
  addFavorite: (fav: Favorite) => invoke<Favorite>("add_favorite", { fav }),
  listFavorites: () => invoke<Favorite[]>("list_favorites"),
  removeFavorite: (id: string) => invoke<void>("remove_favorite", { id }),
};

export function uid(prefix = ""): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
