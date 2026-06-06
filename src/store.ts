// Lightweight external store for lazily-loaded, cached DB metadata, keyed by
// connection id. Components subscribe via useSyncExternalStore (see useMeta).
import { useSyncExternalStore } from "react";
import { api } from "./api";
import { ColumnMeta, TableInfo } from "./types";

interface Meta {
  databases?: string[];
  tables: Record<string, TableInfo[]>; // by db
  columns: Record<string, ColumnMeta[]>; // by `${db}/${table}`
}

const cache: Record<string, Meta> = {};
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();

let version = 0;
function emit() {
  version++;
  listeners.forEach((l) => l());
}

function meta(connId: string): Meta {
  if (!cache[connId]) cache[connId] = { tables: {}, columns: {} };
  return cache[connId];
}

// Deduplicate concurrent loads of the same key.
function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export const metaStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  version: () => version,

  snapshot(connId: string): Meta {
    return meta(connId);
  },

  ensureDatabases(connId: string): Promise<string[]> {
    const m = meta(connId);
    if (m.databases) return Promise.resolve(m.databases);
    return once(`${connId}:dbs`, async () => {
      m.databases = await api.listDatabases(connId);
      emit();
      return m.databases;
    });
  },

  ensureTables(connId: string, db: string): Promise<TableInfo[]> {
    const m = meta(connId);
    if (m.tables[db]) return Promise.resolve(m.tables[db]);
    return once(`${connId}:tables:${db}`, async () => {
      const t = await api.listTables(connId, db);
      m.tables[db] = t;
      emit();
      return t;
    });
  },

  ensureColumns(connId: string, db: string, table: string): Promise<ColumnMeta[]> {
    const m = meta(connId);
    const key = `${db}/${table}`;
    if (m.columns[key]) return Promise.resolve(m.columns[key]);
    return once(`${connId}:cols:${key}`, async () => {
      const c = await api.listColumns(connId, db, table);
      m.columns[key] = c;
      emit();
      return c;
    });
  },

  /** Drop all cached metadata for a connection (manual refresh). */
  clear(connId: string) {
    delete cache[connId];
    emit();
  },
};

/** Subscribe a component to metadata changes; returns the connection's snapshot. */
export function useMeta(connId: string): Meta {
  // Track the monotonically-increasing version so in-place cache mutations
  // still trigger re-renders; the data itself is read from the live snapshot.
  useSyncExternalStore(metaStore.subscribe, metaStore.version);
  return metaStore.snapshot(connId);
}
