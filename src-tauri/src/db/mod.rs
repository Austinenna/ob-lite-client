pub mod exec;
pub mod meta;
pub mod pool;
pub mod value;

use serde::Serialize;

/// Column description sent to the frontend. Shape mirrors the prototype's
/// `schemaFor` (name/type/nullable/def/key/extra).
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ColumnMeta {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub nullable: bool,
    pub def: Option<String>,
    pub key: String,
    pub extra: String,
}

/// Result of executing any statement.
/// `kind = "rows"` carries columns/rows/rowCount; `kind = "affected"` carries affected.
#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub columns: Option<Vec<ColumnMeta>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rows: Option<Vec<Vec<serde_json::Value>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub row_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub affected: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_insert_id: Option<u64>,
    pub duration_ms: u64,
    pub truncated: bool,
    /// For server-side paged queries: whether a further page exists.
    pub has_more: bool,
}

impl QueryResult {
    pub fn affected(affected: u64, last_insert_id: Option<u64>) -> Self {
        QueryResult {
            kind: "affected".into(),
            affected: Some(affected),
            last_insert_id,
            ..Default::default()
        }
    }
}
