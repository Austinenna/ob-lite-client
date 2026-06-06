import { useMemo, useState } from "react";
import { api, uid } from "../api";
import { T } from "../theme";
import { ConnectionConfig, Env, isAppError } from "../types";
import { Btn, EnvBadge } from "./ui";

const BLANK = (): ConnectionConfig => ({
  id: "",
  name: "",
  env: "dev",
  host: "",
  port: 2883,
  user: "",
  database: "",
  sslEnabled: false,
  primary: "",
  createdAt: 0,
  updatedAt: 0,
});

export function ConnectionManager({
  connections,
  onClose,
  onChanged,
  onToast,
}: {
  connections: ConnectionConfig[];
  onClose: () => void;
  onChanged: () => void;
  onToast: (m: string) => void;
}) {
  const [selId, setSelId] = useState<string | "new">(connections[0]?.id ?? "new");
  const selected = useMemo<ConnectionConfig>(
    () => (selId === "new" ? BLANK() : connections.find((c) => c.id === selId) ?? BLANK()),
    [selId, connections]
  );
  const [form, setForm] = useState<ConnectionConfig>(selected);
  const [password, setPassword] = useState("");
  const [formKey, setFormKey] = useState(selId);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // reset the form when the selection changes
  if (formKey !== selId) {
    setForm(selected);
    setPassword("");
    setTestMsg(null);
    setFormKey(selId);
  }

  const set = <K extends keyof ConnectionConfig>(k: K, v: ConnectionConfig[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const editing = selId !== "new";

  const onTest = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      // when editing without typing a new password, the backend can't read the
      // keychain in test (it takes an explicit password), so prompt to type it.
      const r = await api.testConnection(form, password);
      setTestMsg({ ok: true, text: `连接成功 · ${r.server || "OK"} · ${r.pingMs}ms` });
    } catch (e) {
      setTestMsg({ ok: false, text: isAppError(e) ? `${e.zh} (${e.msg})` : String(e) });
    } finally {
      setTesting(false);
    }
  };

  const onSave = async () => {
    try {
      const cfg = { ...form, id: form.id || uid("c_") };
      await api.saveConnection(cfg, password || undefined);
      onToast("已保存连接 · " + cfg.name);
      setSelId(cfg.id);
      setFormKey(cfg.id);
      onChanged();
    } catch (e) {
      onToast(isAppError(e) ? e.zh : "保存失败");
    }
  };

  const onDelete = async () => {
    if (!editing) return;
    try {
      await api.deleteConnection(form.id);
      onToast("已删除连接 · " + form.name);
      setSelId("new");
      setFormKey("new");
      onChanged();
    } catch (e) {
      onToast(isAppError(e) ? e.zh : "删除失败");
    }
  };

  const label = (s: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: T.faint, letterSpacing: ".03em", marginBottom: 5 }}>{s}</div>
  );
  const input = (
    value: string | number,
    onChange: (v: string) => void,
    extra?: { type?: string; placeholder?: string; mono?: boolean }
  ) => (
    <input
      value={value}
      type={extra?.type}
      placeholder={extra?.placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 9, padding: "8px 11px", fontSize: 12.5, color: T.text, outline: "none", fontFamily: extra?.mono ? T.mono : T.sans, background: T.card }}
    />
  );

  const grouped: [Env, ConnectionConfig[]][] = (["prod", "dev", "test"] as Env[]).map((e) => [e, connections.filter((c) => c.env === e)]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 950, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,20,30,.22)" }} />
      <div style={{ position: "relative", width: 760, height: 540, background: T.canvas, borderRadius: 18, boxShadow: T.shadowLg, display: "flex", overflow: "hidden", animation: "obIn .16s ease" }}>
        {/* list */}
        <div style={{ width: 250, background: T.card, borderRight: `1px solid ${T.line}`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 16px 10px", fontSize: 14, fontWeight: 700 }}>连接管理</div>
          <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
            {grouped.map(([env, conns]) =>
              conns.length === 0 ? null : (
                <div key={env} style={{ marginBottom: 6 }}>
                  <div style={{ padding: "4px 8px" }}><EnvBadge env={env} /></div>
                  {conns.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setSelId(c.id)}
                      style={{ padding: "8px 10px", borderRadius: 9, cursor: "pointer", background: selId === c.id ? T.blueSoft : "transparent", color: selId === c.id ? T.blue : T.text, fontSize: 12.5, fontWeight: selId === c.id ? 600 : 500 }}
                    >
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: T.faint, fontFamily: T.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.host}:{c.port}</div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
          <div style={{ padding: 10, borderTop: `1px solid ${T.lineSoft}` }}>
            <Btn kind="default" onClick={() => setSelId("new")} style={{ width: "100%", justifyContent: "center" }}>＋ 新建连接</Btn>
          </div>
        </div>

        {/* form */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${T.line}` }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{editing ? "编辑连接" : "新建连接"}</div>
            <button onClick={onClose} style={{ border: "none", background: T.card, borderRadius: 9, width: 30, height: 30, cursor: "pointer", color: T.dim, fontSize: 16 }}>×</button>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1 / 3" }}>
              {label("连接名称")}
              {input(form.name, (v) => set("name", v), { placeholder: "如：订单中心 · 生产" })}
            </div>
            <div>
              {label("环境")}
              <div style={{ display: "flex", gap: 6 }}>
                {(["prod", "dev", "test"] as Env[]).map((e) => (
                  <button key={e} onClick={() => set("env", e)} style={{ flex: 1, border: `1px solid ${form.env === e ? T.blue : T.line}`, background: form.env === e ? T.blueSoft : T.card, color: form.env === e ? T.blue : T.dim, borderRadius: 9, padding: "7px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {e === "prod" ? "生产" : e === "dev" ? "开发" : "测试"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              {label("默认数据库（可空）")}
              {input(form.database || "", (v) => set("database", v), { mono: true, placeholder: "order_center" })}
            </div>
            <div>
              {label("Host")}
              {input(form.host, (v) => set("host", v), { mono: true, placeholder: "10.0.0.1" })}
            </div>
            <div>
              {label("Port")}
              {input(form.port, (v) => set("port", Number(v) || 0), { mono: true, type: "number" })}
            </div>
            <div style={{ gridColumn: "1 / 3" }}>
              {label("用户名（支持 user@tenant#cluster）")}
              {input(form.user, (v) => set("user", v), { mono: true, placeholder: "root@mysql#obcluster" })}
            </div>
            <div style={{ gridColumn: "1 / 3" }}>
              {label(editing ? "密码（留空表示不修改）" : "密码")}
              {input(password, setPassword, { type: "password", mono: true, placeholder: editing ? "••••••（已存于 Keychain）" : "" })}
            </div>
            <div style={{ gridColumn: "1 / 3", display: "flex", alignItems: "center", gap: 8 }}>
              <input id="ssl" type="checkbox" checked={form.sslEnabled} onChange={(e) => set("sslEnabled", e.target.checked)} />
              <label htmlFor="ssl" style={{ fontSize: 12.5, color: T.dim }}>启用 SSL/TLS</label>
            </div>
            {testMsg && (
              <div style={{ gridColumn: "1 / 3", fontSize: 12, padding: "8px 11px", borderRadius: 9, background: testMsg.ok ? "#e7f6ec" : "#fdf4f2", color: testMsg.ok ? "#1f8a4d" : "#cf5a3a", border: `1px solid ${testMsg.ok ? "#aedcc0" : "#f3c3b6"}`, wordBreak: "break-word" }}>
                {testMsg.text}
              </div>
            )}
          </div>

          <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 8 }}>
            {editing && <Btn kind="ghost" onClick={onDelete} style={{ color: "#cf5a3a" }}>删除</Btn>}
            <div style={{ flex: 1 }} />
            <Btn kind="default" onClick={onTest} disabled={testing || !form.host || !form.user}>{testing ? "测试中…" : "测试连接"}</Btn>
            <Btn kind="primary" onClick={onSave} disabled={!form.name || !form.host || !form.user}>保存</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
