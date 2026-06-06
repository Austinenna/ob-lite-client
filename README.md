# OB Lite Client

macOS 上极致轻量的 OceanBase（MySQL 模式）数据库客户端。专注三件事：**自写 SQL 查询**、**点开表看数据并筛选**、**多环境连接管理**（开发 / 测试 / 生产）。

## 技术栈

| 层 | 选型 |
|---|---|
| 桌面容器 | Tauri 2（原生 WebView，体积/内存远小于 Electron） |
| 前端 | React 18 + TypeScript + Vite |
| 表格 | `@tanstack/react-virtual` 虚拟滚动 |
| SQL 编辑器 | CodeMirror 6（`@codemirror/lang-sql`，⌘↵ 执行 / Esc 取消） |
| 后端 | Rust（tokio 异步），驱动 `mysql_async`（动态结果 + KILL QUERY 取消） |
| 本地存储 | SQLite（`rusqlite`）存连接元数据 / 查询历史 / 收藏 |
| 密码 | macOS Keychain（`keyring`），绝不落普通文件 |

## 架构

```
React(前端)  ──invoke──▶  Tauri 命令层(src-tauri/src/commands)
                              │
              ┌───────────────┼────────────────┐
        db(连接池/执行/元数据)  store(SQLite)   secrets(Keychain)
              │
        mysql_async ──▶ OceanBase (MySQL 协议)
```

- 后端逻辑层（`db/`）与 Tauri 命令层解耦，便于后续复用为 SQL CLI。
- 元数据按节点展开**懒加载并缓存**（`src/store.ts`），可手动刷新。
- 查询**异步执行、可超时（默认 30s）、可取消**（`KILL QUERY <thread_id>`）。
- 结果默认上限 1000 行、表数据每页默认 200 行、连接超时 10s（见 `commands/query.rs` 与 `db/pool.rs` 常量）。
- 单元格 NULL / 二进制（BLOB）特殊标记，超长文本截断、抽屉查看完整内容。

### 目录

```
src/                    前端
  api.ts                Tauri 命令的类型化封装
  store.ts              元数据懒加载缓存
  components/           DataGrid / Sidebar / QueryView(CodeMirror) / TableView / ConnectionManager …
src-tauri/src/
  commands/             connections / browse / query 三组命令
  db/                   pool(连接池) value(值编码) meta(元数据) exec(执行/取消)
  store.rs              SQLite：连接 / 历史 / 收藏
  secrets.rs            Keychain 密码读写
  error.rs              统一错误 + MySQL 错误→中文映射
```

## 开发运行

前置：Rust、Node ≥ 18、pnpm、Xcode Command Line Tools。

```bash
pnpm install
pnpm tauri dev      # 开发模式，热重载
pnpm tauri build    # 打包为 .app / .dmg
```

首次进入会提示新建连接：填写名称 / 环境 / Host / Port / 用户名（支持 `user@tenant#cluster`）/ 密码 / 默认库，点「测试连接」验证，保存后即可连接、浏览、查询。

## 当前未做（后续版本）

数据编辑、CSV/JSON 导出、SQL 收藏 UI、连接分组、只读模式、多结果集、SQL CLI。后端逻辑层已为 CLI 复用预留解耦。
