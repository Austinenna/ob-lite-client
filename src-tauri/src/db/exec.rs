//! Statement execution: streaming result collection with a hard row cap,
//! plus table-data / count SQL builders and `KILL QUERY` cancellation.

use futures_util::StreamExt;
use mysql_async::prelude::*;
use mysql_async::{Conn, Pool, Row, Value};
use serde_json::Value as Json;

use super::pool::ident;
use super::{value, QueryResult};
use crate::error::AppError;

/// Run `sql` on `conn`, collecting at most `max_rows` rows. If more rows are
/// available, `truncated` is set and streaming stops early — the caller should
/// discard (disconnect) the connection rather than return it to the pool.
pub async fn collect_result(conn: &mut Conn, sql: &str, max_rows: usize) -> Result<QueryResult, AppError> {
    let mut qres = conn.query_iter(sql).await?;
    let cols = qres.columns();

    match cols {
        Some(cols) if !cols.is_empty() => {
            let metas = value::columns_from_result(&cols);
            let binary: Vec<bool> = cols.iter().map(value::column_is_binary).collect();
            let n = cols.len();

            let mut rows: Vec<Vec<Json>> = Vec::new();
            let mut truncated = false;
            {
                let mut stream = qres.stream::<Row>().await?;
                if let Some(s) = stream.as_mut() {
                    while let Some(item) = s.next().await {
                        let row = item?;
                        if rows.len() >= max_rows {
                            truncated = true;
                            break;
                        }
                        let cells = (0..n)
                            .map(|i| value::value_to_cell(row.as_ref(i).unwrap_or(&Value::NULL), binary[i]))
                            .collect();
                        rows.push(cells);
                    }
                }
            }
            let row_count = rows.len();
            Ok(QueryResult {
                kind: "rows".into(),
                columns: Some(metas),
                rows: Some(rows),
                row_count: Some(row_count),
                truncated,
                ..Default::default()
            })
        }
        _ => {
            let affected = qres.affected_rows();
            let last = qres.last_insert_id();
            qres.drop_result().await?;
            Ok(QueryResult::affected(affected, last))
        }
    }
}

/// Cancel a running query by issuing `KILL QUERY <thread_id>` on a fresh
/// connection from the same pool.
pub async fn kill_query(pool: &Pool, thread_id: u32) -> Result<(), AppError> {
    let mut conn = pool.get_conn().await?;
    conn.query_drop(format!("KILL QUERY {}", thread_id)).await?;
    Ok(())
}

pub fn build_table_query(
    db: &str,
    table: &str,
    where_clause: Option<&str>,
    order_by: Option<&str>,
    page: u64,
    page_size: u64,
) -> String {
    let mut sql = format!("SELECT * FROM {}.{}", ident(db), ident(table));
    if let Some(w) = where_clause {
        let w = w.trim();
        if !w.is_empty() {
            sql.push_str(&format!(" WHERE {}", w));
        }
    }
    if let Some(ob) = order_by {
        sql.push_str(&format!(" ORDER BY {}", ident(ob)));
    }
    let offset = page.max(1).saturating_sub(1) * page_size;
    sql.push_str(&format!(" LIMIT {} OFFSET {}", page_size, offset));
    sql
}

pub fn build_count_query(db: &str, table: &str, where_clause: Option<&str>) -> String {
    let mut sql = format!("SELECT COUNT(*) FROM {}.{}", ident(db), ident(table));
    if let Some(w) = where_clause {
        let w = w.trim();
        if !w.is_empty() {
            sql.push_str(&format!(" WHERE {}", w));
        }
    }
    sql
}
