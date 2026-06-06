use std::time::{Duration, Instant};

use mysql_async::prelude::*;
use serde::Serialize;
use tauri::State;

use crate::db::pool;
use crate::error::AppError;
use crate::secrets;
use crate::state::AppState;
use crate::store::{self, ConnectionConfig};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestResult {
    pub server: String,
    pub ping_ms: u64,
}

#[tauri::command]
pub async fn list_connections(state: State<'_, AppState>) -> Result<Vec<ConnectionConfig>, AppError> {
    store::list_connections(state.inner())
}

#[tauri::command]
pub async fn save_connection(
    state: State<'_, AppState>,
    cfg: ConnectionConfig,
    password: Option<String>,
) -> Result<ConnectionConfig, AppError> {
    let saved = store::upsert_connection(state.inner(), cfg)?;
    if let Some(pw) = password {
        if !pw.is_empty() {
            secrets::set_password(&saved.id, &pw)?;
        }
    }
    Ok(saved)
}

#[tauri::command]
pub async fn delete_connection(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    if let Some(p) = state.pools.write().await.remove(&id) {
        p.disconnect().await.ok();
    }
    store::delete_connection(state.inner(), &id)?;
    secrets::delete_password(&id).ok();
    Ok(())
}

#[tauri::command]
pub async fn test_connection(cfg: ConnectionConfig, password: String) -> Result<TestResult, AppError> {
    let opts = pool::build_opts(&cfg, if password.is_empty() { None } else { Some(password) });
    let started = Instant::now();
    let fut = async {
        let mut conn = mysql_async::Conn::new(opts).await?;
        let v: Option<String> = conn.query_first("SELECT VERSION()").await?;
        conn.disconnect().await.ok();
        Ok::<_, AppError>(v.unwrap_or_default())
    };
    match tokio::time::timeout(Duration::from_secs(pool::CONNECT_TIMEOUT_SECS), fut).await {
        Ok(Ok(server)) => Ok(TestResult { server, ping_ms: started.elapsed().as_millis() as u64 }),
        Ok(Err(e)) => Err(e),
        Err(_) => Err(AppError::new(
            "TIMEOUT",
            "connect timed out",
            format!("连接超时（>{}s），请检查 Host / Port 与网络。", pool::CONNECT_TIMEOUT_SECS),
        )),
    }
}

#[tauri::command]
pub async fn open_connection(state: State<'_, AppState>, id: String) -> Result<TestResult, AppError> {
    let cfg = store::get_connection(state.inner(), &id)?
        .ok_or_else(|| AppError::new("NOTFOUND", "no such connection", "连接配置不存在。"))?;
    let pw = secrets::get_password(&id)?;
    let new_pool = pool::build_pool(&cfg, pw);

    let started = Instant::now();
    let verify = async {
        let mut c = new_pool.get_conn().await?;
        let v: Option<String> = c.query_first("SELECT VERSION()").await?;
        Ok::<_, AppError>(v.unwrap_or_default())
    };
    let server = match tokio::time::timeout(Duration::from_secs(pool::CONNECT_TIMEOUT_SECS), verify).await {
        Ok(Ok(v)) => v,
        Ok(Err(e)) => {
            new_pool.disconnect().await.ok();
            return Err(e);
        }
        Err(_) => {
            new_pool.disconnect().await.ok();
            return Err(AppError::new(
                "TIMEOUT",
                "connect timed out",
                format!("连接超时（>{}s）。", pool::CONNECT_TIMEOUT_SECS),
            ));
        }
    };

    state.pools.write().await.insert(id, new_pool);
    Ok(TestResult { server, ping_ms: started.elapsed().as_millis() as u64 })
}

#[tauri::command]
pub async fn close_connection(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    if let Some(p) = state.pools.write().await.remove(&id) {
        p.disconnect().await.ok();
    }
    Ok(())
}
