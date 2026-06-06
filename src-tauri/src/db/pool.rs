//! Connection pool / option construction for mysql_async against OceanBase
//! (MySQL protocol). The OceanBase account form `user@tenant#cluster` is passed
//! through verbatim as the handshake username.

use mysql_async::{Opts, OptsBuilder, Pool, PoolConstraints, PoolOpts, SslOpts};

use crate::store::ConnectionConfig;

/// Default connect/handshake timeout used by `test_connection` / `open_connection`.
pub const CONNECT_TIMEOUT_SECS: u64 = 10;

pub fn build_opts(cfg: &ConnectionConfig, password: Option<String>) -> Opts {
    let constraints = PoolConstraints::new(0, 8).unwrap();
    let pool_opts = PoolOpts::default().with_constraints(constraints);

    let mut builder = OptsBuilder::default()
        .ip_or_hostname(cfg.host.clone())
        .tcp_port(cfg.port)
        .user(Some(cfg.user.clone()))
        .pass(password)
        .db_name(cfg.database.clone())
        // OceanBase (MySQL mode) has no `@@socket` system variable; mysql_async
        // queries it on connect when prefer_socket is on, which errors out.
        .prefer_socket(false)
        // run on every fresh connection (§8.3)
        .init(vec!["SET NAMES utf8mb4"])
        .pool_opts(pool_opts);

    if cfg.ssl_enabled {
        // Accept the server cert without a local CA bundle; OB clusters are
        // typically reached over trusted networks.
        builder = builder.ssl_opts(Some(
            SslOpts::default()
                .with_danger_accept_invalid_certs(true)
                .with_danger_skip_domain_validation(true),
        ));
    }

    Opts::from(builder)
}

pub fn build_pool(cfg: &ConnectionConfig, password: Option<String>) -> Pool {
    Pool::new(build_opts(cfg, password))
}

/// Escape a SQL identifier (db / table / column) for safe interpolation.
pub fn ident(name: &str) -> String {
    format!("`{}`", name.replace('`', "``"))
}
