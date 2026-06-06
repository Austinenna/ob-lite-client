//! Metadata queries (databases / tables / columns / indexes / DDL) via the
//! `SHOW ...` statements recommended for OceanBase MySQL mode (§8.2).

use mysql_async::prelude::*;
use mysql_async::{Pool, Row, Value};
use serde::Serialize;

use super::exec;
use super::pool::ident;
use super::{ColumnMeta, QueryResult};
use crate::error::AppError;

#[derive(Serialize, Clone)]
pub struct TableInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String, // "table" | "view"
}

/// Read a metadata cell as text (SHOW output columns are all byte strings).
fn cell_string(row: &Row, i: usize) -> Option<String> {
    match row.as_ref(i) {
        Some(Value::Bytes(b)) => Some(String::from_utf8_lossy(b).to_string()),
        Some(Value::Int(n)) => Some(n.to_string()),
        Some(Value::UInt(n)) => Some(n.to_string()),
        Some(Value::NULL) | None => None,
        Some(v) => Some(format!("{:?}", v)),
    }
}

pub async fn databases(pool: &Pool) -> Result<Vec<String>, AppError> {
    let mut conn = pool.get_conn().await?;
    let rows: Vec<String> = conn.query("SHOW DATABASES").await?;
    Ok(rows)
}

pub async fn tables(pool: &Pool, db: &str) -> Result<Vec<TableInfo>, AppError> {
    let mut conn = pool.get_conn().await?;
    let sql = format!("SHOW FULL TABLES IN {}", ident(db));
    let rows: Vec<Row> = conn.query(sql).await?;
    let out = rows
        .iter()
        .map(|r| {
            let name = cell_string(r, 0).unwrap_or_default();
            let t = cell_string(r, 1).unwrap_or_default();
            let type_ = if t.eq_ignore_ascii_case("VIEW") { "view" } else { "table" };
            TableInfo { name, type_: type_.to_string() }
        })
        .collect();
    Ok(out)
}

pub async fn columns(pool: &Pool, db: &str, table: &str) -> Result<Vec<ColumnMeta>, AppError> {
    let mut conn = pool.get_conn().await?;
    let sql = format!("SHOW FULL COLUMNS FROM {}.{}", ident(db), ident(table));
    let rows: Vec<Row> = conn.query(sql).await?;
    // SHOW FULL COLUMNS: 0=Field 1=Type 2=Collation 3=Null 4=Key 5=Default 6=Extra ...
    let out = rows
        .iter()
        .map(|r| ColumnMeta {
            name: cell_string(r, 0).unwrap_or_default(),
            type_: cell_string(r, 1).unwrap_or_default(),
            nullable: cell_string(r, 3).map(|s| s.eq_ignore_ascii_case("YES")).unwrap_or(false),
            def: cell_string(r, 5),
            key: cell_string(r, 4).unwrap_or_default(),
            extra: cell_string(r, 6).unwrap_or_default(),
        })
        .collect();
    Ok(out)
}

pub async fn create_table(pool: &Pool, db: &str, table: &str) -> Result<String, AppError> {
    let mut conn = pool.get_conn().await?;
    let sql = format!("SHOW CREATE TABLE {}.{}", ident(db), ident(table));
    let row: Option<Row> = conn.query_first(sql).await?;
    // idx 1 is "Create Table" (or "Create View")
    Ok(row.and_then(|r| cell_string(&r, 1)).unwrap_or_default())
}

pub async fn indexes(pool: &Pool, db: &str, table: &str) -> Result<QueryResult, AppError> {
    let mut conn = pool.get_conn().await?;
    let sql = format!("SHOW INDEX FROM {}.{}", ident(db), ident(table));
    exec::collect_result(&mut conn, &sql, 1000).await
}

/// Single integer-ish primary key column name, if the table has exactly one PK
/// column. Used to give table-data pagination a stable ORDER BY.
pub fn single_pk(cols: &[ColumnMeta]) -> Option<String> {
    let pks: Vec<&ColumnMeta> = cols.iter().filter(|c| c.key == "PRI").collect();
    if pks.len() == 1 {
        Some(pks[0].name.clone())
    } else {
        None
    }
}
