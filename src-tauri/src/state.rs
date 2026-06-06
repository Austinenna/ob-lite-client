use std::collections::HashMap;
use std::sync::Mutex as StdMutex;

use mysql_async::Pool;
use rusqlite::Connection as SqliteConn;
use tokio::sync::{Mutex, RwLock};

use crate::error::AppError;

/// Tracks an in-flight query so it can be cancelled via `KILL QUERY`.
#[derive(Clone)]
pub struct RunningQuery {
    pub conn_id: String,
    pub thread_id: u32,
}

/// Global application state managed by Tauri.
///
/// - `store`: the local SQLite handle. rusqlite is synchronous; callers lock,
///   do the work, and unlock without ever holding the guard across an `.await`.
/// - `pools`: one mysql_async connection pool per *opened* connection.
/// - `running`: in-flight queries keyed by a frontend-supplied query id.
pub struct AppState {
    pub store: StdMutex<SqliteConn>,
    pub pools: RwLock<HashMap<String, Pool>>,
    pub running: Mutex<HashMap<String, RunningQuery>>,
}

impl AppState {
    pub fn new(store: SqliteConn) -> Self {
        AppState {
            store: StdMutex::new(store),
            pools: RwLock::new(HashMap::new()),
            running: Mutex::new(HashMap::new()),
        }
    }

    /// Clone out an opened pool, or error if the connection is not open yet.
    pub async fn pool(&self, conn_id: &str) -> Result<Pool, AppError> {
        let pools = self.pools.read().await;
        pools
            .get(conn_id)
            .cloned()
            .ok_or_else(|| AppError::new("NOTCONN", "connection not open", "连接未打开，请先连接。"))
    }
}
