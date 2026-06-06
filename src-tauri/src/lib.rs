mod commands;
mod db;
mod error;
mod secrets;
mod state;
mod store;

use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("resolve app data dir");
            std::fs::create_dir_all(&dir).ok();
            let db_path = dir.join("oblite.sqlite");
            let sqlite = store::open(&db_path).expect("open local sqlite store");
            app.manage(AppState::new(sqlite));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_connections,
            commands::save_connection,
            commands::delete_connection,
            commands::test_connection,
            commands::open_connection,
            commands::close_connection,
            commands::list_databases,
            commands::list_tables,
            commands::list_columns,
            commands::list_indexes,
            commands::get_create_table,
            commands::query_table,
            commands::count_table,
            commands::execute_sql,
            commands::cancel_query,
            commands::list_history,
            commands::clear_history,
            commands::add_favorite,
            commands::list_favorites,
            commands::remove_favorite,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
