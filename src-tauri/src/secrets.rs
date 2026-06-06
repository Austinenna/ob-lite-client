//! Password storage backed by the macOS Keychain (via the `keyring` crate).
//! Connection passwords never touch the SQLite file or any plain config.

use keyring::Entry;

use crate::error::AppError;

const SERVICE: &str = "com.enna.oblite";

fn entry(conn_id: &str) -> Result<Entry, AppError> {
    Entry::new(SERVICE, conn_id).map_err(AppError::from)
}

pub fn set_password(conn_id: &str, password: &str) -> Result<(), AppError> {
    entry(conn_id)?.set_password(password).map_err(AppError::from)
}

pub fn get_password(conn_id: &str) -> Result<Option<String>, AppError> {
    match entry(conn_id)?.get_password() {
        Ok(p) => Ok(Some(p)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn delete_password(conn_id: &str) -> Result<(), AppError> {
    match entry(conn_id)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.into()),
    }
}
