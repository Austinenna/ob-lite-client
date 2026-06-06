use serde::Serialize;

/// Error surfaced to the frontend. Always carries the raw `msg` plus a short
/// human-readable Chinese explanation `zh`, per the requirements (§3.6).
#[derive(Debug, Serialize)]
pub struct AppError {
    pub code: String,
    pub msg: String,
    pub zh: String,
}

impl AppError {
    pub fn new(code: impl Into<String>, msg: impl Into<String>, zh: impl Into<String>) -> Self {
        AppError {
            code: code.into(),
            msg: msg.into(),
            zh: zh.into(),
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.msg)
    }
}
impl std::error::Error for AppError {}

impl From<mysql_async::Error> for AppError {
    fn from(e: mysql_async::Error) -> Self {
        use mysql_async::Error as E;
        match &e {
            E::Server(se) => {
                let zh = match se.code {
                    1045 => "用户名或密码错误。OceanBase 账号通常需要 user@tenant#cluster 格式，请检查。",
                    1049 => "数据库不存在。",
                    1044 | 1142 | 1227 => "权限不足，当前账号无权执行该操作。",
                    1146 => "表不存在。",
                    1054 => "字段不存在，请检查列名。",
                    1064 => "SQL 语法错误，请检查语句。",
                    1317 => "查询已被取消。",
                    _ => "数据库返回错误。",
                };
                AppError::new(se.code.to_string(), se.message.clone(), zh)
            }
            E::Io(_) => {
                let m = e.to_string();
                let lower = m.to_lowercase();
                let zh = if lower.contains("refused") {
                    "无法连接：目标主机或端口不可达，请检查 Host / Port 与网络。"
                } else if lower.contains("timed out") || lower.contains("timeout") {
                    "连接超时，请检查网络或主机是否可达。"
                } else if lower.contains("reset") || lower.contains("broken pipe") || lower.contains("closed") {
                    "连接已断开，请重新连接。"
                } else if lower.contains("dns") || lower.contains("resolve") || lower.contains("lookup") || lower.contains("name or service") {
                    "无法解析主机名，请检查 Host。"
                } else {
                    "网络或 IO 错误。"
                };
                AppError::new("CONN", m, zh)
            }
            _ => AppError::new("DB", e.to_string(), "数据库操作失败。"),
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::new("STORE", e.to_string(), "本地数据存取失败。")
    }
}

impl From<keyring::Error> for AppError {
    fn from(e: keyring::Error) -> Self {
        AppError::new("SECRET", e.to_string(), "钥匙串(Keychain)访问失败。")
    }
}
