//! Local persistence (SQLite via rusqlite): connection metadata, query history
//! and SQL favorites. Passwords are NOT stored here — see `secrets.rs`.

use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection as SqliteConn};
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::state::AppState;

pub const HISTORY_LIMIT: usize = 200;

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionConfig {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub env: String, // "prod" | "dev" | "test"
    pub host: String,
    pub port: u16,
    pub user: String,
    #[serde(default)]
    pub database: Option<String>,
    #[serde(default)]
    pub ssl_enabled: bool,
    #[serde(default)]
    pub primary: Option<String>,
    #[serde(default)]
    pub created_at: i64,
    #[serde(default)]
    pub updated_at: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub conn_id: String,
    pub database: Option<String>,
    pub sql: String,
    pub status: String,
    pub duration_ms: Option<i64>,
    pub row_count: Option<i64>,
    pub affected: Option<i64>,
    pub error: Option<String>,
    pub executed_at: i64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Favorite {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub sql: String,
    #[serde(default)]
    pub conn_id: Option<String>,
    #[serde(default)]
    pub created_at: i64,
}

/// Open (creating if needed) the SQLite database and run migrations.
pub fn open(path: &Path) -> Result<SqliteConn, AppError> {
    let conn = SqliteConn::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS connections (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            env         TEXT NOT NULL,
            host        TEXT NOT NULL,
            port        INTEGER NOT NULL,
            user        TEXT NOT NULL,
            database    TEXT,
            ssl_enabled INTEGER NOT NULL DEFAULT 0,
            primary_db  TEXT,
            created_at  INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS history (
            id          TEXT PRIMARY KEY,
            conn_id     TEXT NOT NULL,
            database    TEXT,
            sql         TEXT NOT NULL,
            status      TEXT NOT NULL,
            duration_ms INTEGER,
            row_count   INTEGER,
            affected    INTEGER,
            error       TEXT,
            executed_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_history_time ON history(executed_at DESC);
        CREATE TABLE IF NOT EXISTS favorites (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            sql        TEXT NOT NULL,
            conn_id    TEXT,
            created_at INTEGER NOT NULL
        );
        "#,
    )?;
    Ok(conn)
}

// ---------- connections ----------

pub fn list_connections(state: &AppState) -> Result<Vec<ConnectionConfig>, AppError> {
    let db = state.store.lock().unwrap();
    let mut stmt = db.prepare(
        "SELECT id, name, env, host, port, user, database, ssl_enabled, primary_db, created_at, updated_at
         FROM connections ORDER BY env, name",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok(ConnectionConfig {
                id: r.get(0)?,
                name: r.get(1)?,
                env: r.get(2)?,
                host: r.get(3)?,
                port: r.get::<_, i64>(4)? as u16,
                user: r.get(5)?,
                database: r.get(6)?,
                ssl_enabled: r.get::<_, i64>(7)? != 0,
                primary: r.get(8)?,
                created_at: r.get(9)?,
                updated_at: r.get(10)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn get_connection(state: &AppState, id: &str) -> Result<Option<ConnectionConfig>, AppError> {
    let db = state.store.lock().unwrap();
    let mut stmt = db.prepare(
        "SELECT id, name, env, host, port, user, database, ssl_enabled, primary_db, created_at, updated_at
         FROM connections WHERE id = ?1",
    )?;
    let mut rows = stmt.query_map(params![id], |r| {
        Ok(ConnectionConfig {
            id: r.get(0)?,
            name: r.get(1)?,
            env: r.get(2)?,
            host: r.get(3)?,
            port: r.get::<_, i64>(4)? as u16,
            user: r.get(5)?,
            database: r.get(6)?,
            ssl_enabled: r.get::<_, i64>(7)? != 0,
            primary: r.get(8)?,
            created_at: r.get(9)?,
            updated_at: r.get(10)?,
        })
    })?;
    match rows.next() {
        Some(c) => Ok(Some(c?)),
        None => Ok(None),
    }
}

/// Insert or update a connection. Returns the stored config (with id/timestamps filled).
pub fn upsert_connection(state: &AppState, mut cfg: ConnectionConfig) -> Result<ConnectionConfig, AppError> {
    if cfg.id.trim().is_empty() {
        cfg.id = uuid::Uuid::new_v4().to_string();
    }
    let now = now_ms();
    let db = state.store.lock().unwrap();
    let existing_created: Option<i64> = db
        .query_row("SELECT created_at FROM connections WHERE id = ?1", params![cfg.id], |r| r.get(0))
        .ok();
    cfg.created_at = existing_created.unwrap_or(now);
    cfg.updated_at = now;
    db.execute(
        "INSERT INTO connections
            (id, name, env, host, port, user, database, ssl_enabled, primary_db, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
         ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, env=excluded.env, host=excluded.host, port=excluded.port,
            user=excluded.user, database=excluded.database, ssl_enabled=excluded.ssl_enabled,
            primary_db=excluded.primary_db, updated_at=excluded.updated_at",
        params![
            cfg.id, cfg.name, cfg.env, cfg.host, cfg.port as i64, cfg.user, cfg.database,
            cfg.ssl_enabled as i64, cfg.primary, cfg.created_at, cfg.updated_at
        ],
    )?;
    Ok(cfg)
}

pub fn delete_connection(state: &AppState, id: &str) -> Result<(), AppError> {
    let db = state.store.lock().unwrap();
    db.execute("DELETE FROM connections WHERE id = ?1", params![id])?;
    Ok(())
}

// ---------- history ----------

#[allow(clippy::too_many_arguments)]
pub fn add_history(
    state: &AppState,
    conn_id: &str,
    database: Option<&str>,
    sql: &str,
    status: &str,
    duration_ms: Option<i64>,
    row_count: Option<i64>,
    affected: Option<i64>,
    error: Option<&str>,
) -> Result<(), AppError> {
    let db = state.store.lock().unwrap();
    db.execute(
        "INSERT INTO history (id, conn_id, database, sql, status, duration_ms, row_count, affected, error, executed_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![
            uuid::Uuid::new_v4().to_string(), conn_id, database, sql, status,
            duration_ms, row_count, affected, error, now_ms()
        ],
    )?;
    // keep only the most recent HISTORY_LIMIT rows
    db.execute(
        "DELETE FROM history WHERE id NOT IN
            (SELECT id FROM history ORDER BY executed_at DESC LIMIT ?1)",
        params![HISTORY_LIMIT as i64],
    )?;
    Ok(())
}

pub fn list_history(state: &AppState) -> Result<Vec<HistoryEntry>, AppError> {
    let db = state.store.lock().unwrap();
    let mut stmt = db.prepare(
        "SELECT id, conn_id, database, sql, status, duration_ms, row_count, affected, error, executed_at
         FROM history ORDER BY executed_at DESC LIMIT ?1",
    )?;
    let rows = stmt
        .query_map(params![HISTORY_LIMIT as i64], |r| {
            Ok(HistoryEntry {
                id: r.get(0)?,
                conn_id: r.get(1)?,
                database: r.get(2)?,
                sql: r.get(3)?,
                status: r.get(4)?,
                duration_ms: r.get(5)?,
                row_count: r.get(6)?,
                affected: r.get(7)?,
                error: r.get(8)?,
                executed_at: r.get(9)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn clear_history(state: &AppState) -> Result<(), AppError> {
    let db = state.store.lock().unwrap();
    db.execute("DELETE FROM history", [])?;
    Ok(())
}

// ---------- favorites ----------

pub fn add_favorite(state: &AppState, mut fav: Favorite) -> Result<Favorite, AppError> {
    if fav.id.trim().is_empty() {
        fav.id = uuid::Uuid::new_v4().to_string();
    }
    fav.created_at = now_ms();
    let db = state.store.lock().unwrap();
    db.execute(
        "INSERT INTO favorites (id, name, sql, conn_id, created_at) VALUES (?1,?2,?3,?4,?5)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, sql=excluded.sql, conn_id=excluded.conn_id",
        params![fav.id, fav.name, fav.sql, fav.conn_id, fav.created_at],
    )?;
    Ok(fav)
}

pub fn list_favorites(state: &AppState) -> Result<Vec<Favorite>, AppError> {
    let db = state.store.lock().unwrap();
    let mut stmt = db.prepare("SELECT id, name, sql, conn_id, created_at FROM favorites ORDER BY created_at DESC")?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Favorite {
                id: r.get(0)?,
                name: r.get(1)?,
                sql: r.get(2)?,
                conn_id: r.get(3)?,
                created_at: r.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn remove_favorite(state: &AppState, id: &str) -> Result<(), AppError> {
    let db = state.store.lock().unwrap();
    db.execute("DELETE FROM favorites WHERE id = ?1", params![id])?;
    Ok(())
}
