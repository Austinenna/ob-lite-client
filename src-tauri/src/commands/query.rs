use std::time::{Duration, Instant};

use mysql_async::prelude::*;
use tauri::State;

use crate::db::{exec, meta, QueryResult};
use crate::error::AppError;
use crate::state::{AppState, RunningQuery};
use crate::store::{self, Favorite, HistoryEntry};

/// Defaults from requirements §7.4.
const DEFAULT_MAX_ROWS: usize = 1000;
const DEFAULT_PAGE_SIZE: u64 = 50;
const DEFAULT_TIMEOUT_SECS: u64 = 30;

/// Build the statement actually sent to the server. Result-set queries
/// (SELECT / WITH) are wrapped as a derived table and paged with LIMIT/OFFSET
/// so we never fetch more than one page from the database. We fetch one extra
/// row to detect whether a further page exists (no COUNT(*) needed).
/// Returns `(sql_to_run, row_cap, is_paged)`.
fn build_exec(sql: &str, page: u64, page_size: u64) -> (String, usize, bool) {
    let stripped = sql.trim().trim_end_matches(';').trim();
    // skip leading comments so the first keyword (and the wrapped subquery) are clean
    let code = strip_leading_comments(stripped);
    let kw = code.split_whitespace().next().unwrap_or("").to_uppercase();
    let pageable = kw == "SELECT" || kw == "WITH";
    if pageable && !code.is_empty() {
        let offset = page.saturating_sub(1) * page_size;
        let wrapped = format!(
            "SELECT * FROM ({}) AS `__ob_page` LIMIT {} OFFSET {}",
            code,
            page_size + 1,
            offset
        );
        (wrapped, (page_size + 1) as usize, true)
    } else {
        (sql.to_string(), DEFAULT_MAX_ROWS, false)
    }
}

/// Remove leading line/block comments and whitespace from a statement.
fn strip_leading_comments(input: &str) -> &str {
    let mut s = input.trim_start();
    loop {
        if let Some(rest) = s.strip_prefix("--").or_else(|| s.strip_prefix('#')) {
            match rest.find('\n') {
                Some(nl) => s = rest[nl + 1..].trim_start(),
                None => return "",
            }
        } else if let Some(rest) = s.strip_prefix("/*") {
            match rest.find("*/") {
                Some(end) => s = rest[end + 2..].trim_start(),
                None => return "",
            }
        } else {
            return s;
        }
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn query_table(
    state: State<'_, AppState>,
    id: String,
    db: String,
    table: String,
    page: u64,
    page_size: u64,
    where_clause: Option<String>,
    order_by: Option<String>,
) -> Result<QueryResult, AppError> {
    let pool = state.pool(&id).await?;
    // Rich column metadata (type/default/key) also drives PK ordering.
    let cols = meta::columns(&pool, &db, &table).await?;
    let order = order_by.or_else(|| meta::single_pk(&cols));

    let sql = exec::build_table_query(&db, &table, where_clause.as_deref(), order.as_deref(), page, page_size);

    let started = Instant::now();
    let mut conn = pool.get_conn().await?;
    let mut result = exec::collect_result(&mut conn, &sql, page_size as usize).await?;
    result.duration_ms = started.elapsed().as_millis() as u64;
    // Prefer the richer DDL-derived columns over protocol metadata.
    result.columns = Some(cols);
    Ok(result)
}

#[tauri::command]
pub async fn count_table(
    state: State<'_, AppState>,
    id: String,
    db: String,
    table: String,
    where_clause: Option<String>,
) -> Result<u64, AppError> {
    let pool = state.pool(&id).await?;
    let sql = exec::build_count_query(&db, &table, where_clause.as_deref());
    let mut conn = pool.get_conn().await?;
    let n: Option<u64> = conn.query_first(sql).await?;
    Ok(n.unwrap_or(0))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn execute_sql(
    state: State<'_, AppState>,
    id: String,
    sql: String,
    query_id: String,
    database: Option<String>,
    page: Option<u64>,
    page_size: Option<u64>,
    timeout_secs: Option<u64>,
) -> Result<QueryResult, AppError> {
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(DEFAULT_PAGE_SIZE).max(1);
    let timeout_secs = timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS);
    let st = state.inner();

    let (exec_sql, cap, is_paged) = build_exec(&sql, page, page_size);

    let pool = state.pool(&id).await?;
    let mut conn = pool.get_conn().await?;
    let thread_id = conn.id();

    state
        .running
        .lock()
        .await
        .insert(query_id.clone(), RunningQuery { conn_id: id.clone(), thread_id });

    let started = Instant::now();
    let res = tokio::time::timeout(
        Duration::from_secs(timeout_secs),
        exec::collect_result(&mut conn, &exec_sql, cap),
    )
    .await;

    state.running.lock().await.remove(&query_id);

    match res {
        Err(_elapsed) => {
            let _ = exec::kill_query(&pool, thread_id).await;
            conn.disconnect().await.ok();
            let _ = store::add_history(
                st, &id, database.as_deref(), &sql, "timeout",
                Some(timeout_secs as i64 * 1000), None, None, Some("query timeout"),
            );
            Err(AppError::new(
                "TIMEOUT",
                "query execution timed out",
                format!("查询超过 {}s 超时，已自动中断。建议增加 WHERE 条件或 LIMIT。", timeout_secs),
            ))
        }
        Ok(Ok(mut qr)) => {
            qr.duration_ms = started.elapsed().as_millis() as u64;
            // For paged queries we fetched page_size+1 rows: trim the probe row
            // and flag that another page exists.
            if is_paged {
                if let Some(rows) = qr.rows.as_mut() {
                    if rows.len() as u64 > page_size {
                        rows.truncate(page_size as usize);
                        qr.has_more = true;
                    }
                    qr.row_count = Some(rows.len());
                }
            }
            if qr.truncated {
                // result set exceeded the cap; drop the dirty connection
                conn.disconnect().await.ok();
            }
            let rc = qr.row_count.map(|v| v as i64);
            let aff = qr.affected.map(|v| v as i64);
            let _ = store::add_history(
                st, &id, database.as_deref(), &sql, &qr.kind,
                Some(qr.duration_ms as i64), rc, aff, None,
            );
            Ok(qr)
        }
        Ok(Err(e)) => {
            let _ = store::add_history(
                st, &id, database.as_deref(), &sql, "error",
                Some(started.elapsed().as_millis() as i64), None, None, Some(&e.msg),
            );
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn cancel_query(state: State<'_, AppState>, query_id: String) -> Result<(), AppError> {
    let rq = state.running.lock().await.get(&query_id).cloned();
    if let Some(rq) = rq {
        let pool = state.pool(&rq.conn_id).await?;
        exec::kill_query(&pool, rq.thread_id).await?;
    }
    Ok(())
}

// ---------- history & favorites ----------

#[tauri::command]
pub async fn list_history(state: State<'_, AppState>) -> Result<Vec<HistoryEntry>, AppError> {
    store::list_history(state.inner())
}

#[tauri::command]
pub async fn clear_history(state: State<'_, AppState>) -> Result<(), AppError> {
    store::clear_history(state.inner())
}

#[tauri::command]
pub async fn add_favorite(state: State<'_, AppState>, fav: Favorite) -> Result<Favorite, AppError> {
    store::add_favorite(state.inner(), fav)
}

#[tauri::command]
pub async fn list_favorites(state: State<'_, AppState>) -> Result<Vec<Favorite>, AppError> {
    store::list_favorites(state.inner())
}

#[tauri::command]
pub async fn remove_favorite(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    store::remove_favorite(state.inner(), &id)
}
