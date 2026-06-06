//! Encoding of mysql_async `Value` and `Column` into the JSON shapes the
//! frontend DataGrid expects:
//!   NULL   -> { "__null": true }
//!   binary -> { "__blob": <byte length> }
//!   else   -> a string (preserves bigint / decimal precision verbatim)

use mysql_async::consts::{ColumnFlags, ColumnType};
use mysql_async::{Column, Value};
use serde_json::{json, Value as Json};

use super::ColumnMeta;

/// Binary collation id in the MySQL protocol.
const BINARY_CHARSET: u16 = 63;

/// Whether a column carries raw binary data that must not be rendered inline.
pub fn column_is_binary(col: &Column) -> bool {
    use ColumnType::*;
    match col.column_type() {
        MYSQL_TYPE_TINY_BLOB
        | MYSQL_TYPE_MEDIUM_BLOB
        | MYSQL_TYPE_LONG_BLOB
        | MYSQL_TYPE_BLOB
        | MYSQL_TYPE_STRING
        | MYSQL_TYPE_VAR_STRING
        | MYSQL_TYPE_VARCHAR => col.character_set() == BINARY_CHARSET,
        MYSQL_TYPE_BIT | MYSQL_TYPE_GEOMETRY => true,
        _ => false,
    }
}

/// Convert a single cell value to JSON, honoring the binary hint.
pub fn value_to_cell(v: &Value, is_binary: bool) -> Json {
    match v {
        Value::NULL => json!({ "__null": true }),
        Value::Bytes(b) => {
            if is_binary {
                json!({ "__blob": b.len() })
            } else {
                match std::str::from_utf8(b) {
                    Ok(s) => Json::String(s.to_string()),
                    Err(_) => json!({ "__blob": b.len() }),
                }
            }
        }
        Value::Int(i) => Json::String(i.to_string()),
        Value::UInt(u) => Json::String(u.to_string()),
        Value::Float(f) => Json::String(f.to_string()),
        Value::Double(d) => Json::String(d.to_string()),
        Value::Date(y, mo, d, h, mi, s, us) => Json::String(fmt_datetime(*y, *mo, *d, *h, *mi, *s, *us)),
        Value::Time(neg, days, h, mi, s, us) => Json::String(fmt_time(*neg, *days, *h, *mi, *s, *us)),
    }
}

fn fmt_datetime(y: u16, mo: u8, d: u8, h: u8, mi: u8, s: u8, us: u32) -> String {
    let date = format!("{:04}-{:02}-{:02}", y, mo, d);
    if h == 0 && mi == 0 && s == 0 && us == 0 {
        return date;
    }
    let mut t = format!("{} {:02}:{:02}:{:02}", date, h, mi, s);
    if us > 0 {
        t.push_str(&format!(".{:06}", us));
    }
    t
}

fn fmt_time(neg: bool, days: u32, h: u8, mi: u8, s: u8, us: u32) -> String {
    let total_h = days * 24 + h as u32;
    let sign = if neg { "-" } else { "" };
    let mut t = format!("{}{:02}:{:02}:{:02}", sign, total_h, mi, s);
    if us > 0 {
        t.push_str(&format!(".{:06}", us));
    }
    t
}

/// Build best-effort `ColumnMeta` for an arbitrary result set (from protocol
/// column metadata — used by `execute_sql`, where we have no DDL on hand).
pub fn columns_from_result(cols: &[Column]) -> Vec<ColumnMeta> {
    cols.iter()
        .map(|c| {
            let flags = c.flags();
            let key = if flags.contains(ColumnFlags::PRI_KEY_FLAG) {
                "PRI"
            } else if flags.contains(ColumnFlags::UNIQUE_KEY_FLAG) {
                "UNI"
            } else if flags.contains(ColumnFlags::MULTIPLE_KEY_FLAG) {
                "MUL"
            } else {
                ""
            };
            ColumnMeta {
                name: c.name_str().to_string(),
                type_: type_name(c.column_type()).to_string(),
                nullable: !flags.contains(ColumnFlags::NOT_NULL_FLAG),
                def: None,
                key: key.to_string(),
                extra: if flags.contains(ColumnFlags::AUTO_INCREMENT_FLAG) {
                    "auto_increment".into()
                } else {
                    String::new()
                },
            }
        })
        .collect()
}

fn type_name(ct: ColumnType) -> &'static str {
    use ColumnType::*;
    match ct {
        MYSQL_TYPE_TINY => "tinyint",
        MYSQL_TYPE_SHORT => "smallint",
        MYSQL_TYPE_INT24 => "mediumint",
        MYSQL_TYPE_LONG => "int",
        MYSQL_TYPE_LONGLONG => "bigint",
        MYSQL_TYPE_FLOAT => "float",
        MYSQL_TYPE_DOUBLE => "double",
        MYSQL_TYPE_NEWDECIMAL | MYSQL_TYPE_DECIMAL => "decimal",
        MYSQL_TYPE_DATE | MYSQL_TYPE_NEWDATE => "date",
        MYSQL_TYPE_DATETIME | MYSQL_TYPE_DATETIME2 => "datetime",
        MYSQL_TYPE_TIMESTAMP | MYSQL_TYPE_TIMESTAMP2 => "timestamp",
        MYSQL_TYPE_TIME | MYSQL_TYPE_TIME2 => "time",
        MYSQL_TYPE_YEAR => "year",
        MYSQL_TYPE_VARCHAR | MYSQL_TYPE_VAR_STRING => "varchar",
        MYSQL_TYPE_STRING => "char",
        MYSQL_TYPE_TINY_BLOB | MYSQL_TYPE_MEDIUM_BLOB | MYSQL_TYPE_LONG_BLOB | MYSQL_TYPE_BLOB => "blob",
        MYSQL_TYPE_JSON => "json",
        MYSQL_TYPE_BIT => "bit",
        MYSQL_TYPE_GEOMETRY => "geometry",
        MYSQL_TYPE_ENUM => "enum",
        MYSQL_TYPE_SET => "set",
        _ => "unknown",
    }
}
