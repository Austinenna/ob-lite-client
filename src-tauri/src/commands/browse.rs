use tauri::State;

use crate::db::meta::{self, TableInfo};
use crate::db::{ColumnMeta, QueryResult};
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn list_databases(state: State<'_, AppState>, id: String) -> Result<Vec<String>, AppError> {
    let pool = state.pool(&id).await?;
    meta::databases(&pool).await
}

#[tauri::command]
pub async fn list_tables(state: State<'_, AppState>, id: String, db: String) -> Result<Vec<TableInfo>, AppError> {
    let pool = state.pool(&id).await?;
    meta::tables(&pool, &db).await
}

#[tauri::command]
pub async fn list_columns(
    state: State<'_, AppState>,
    id: String,
    db: String,
    table: String,
) -> Result<Vec<ColumnMeta>, AppError> {
    let pool = state.pool(&id).await?;
    meta::columns(&pool, &db, &table).await
}

#[tauri::command]
pub async fn list_indexes(
    state: State<'_, AppState>,
    id: String,
    db: String,
    table: String,
) -> Result<QueryResult, AppError> {
    let pool = state.pool(&id).await?;
    meta::indexes(&pool, &db, &table).await
}

#[tauri::command]
pub async fn get_create_table(
    state: State<'_, AppState>,
    id: String,
    db: String,
    table: String,
) -> Result<String, AppError> {
    let pool = state.pool(&id).await?;
    meta::create_table(&pool, &db, &table).await
}
