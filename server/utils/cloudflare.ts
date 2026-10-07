// Cloudflare D1 / KV 的 REST API 封装（应用自托管，无法用 Workers bindings，只能走 REST）
// D1  query: POST /accounts/{acc}/d1/database/{db}/query  body { sql, params }
// KV  value: GET/PUT /accounts/{acc}/storage/kv/namespaces/{ns}/values/{key}

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

const ALL_PROVIDERS: FileIndexProvider[] = ["telegram", "pinme", "crossbell", "r2"];

interface D1QueryMeta {
  changes?: number;
  last_row_id?: number;
  rows_read?: number;
  rows_written?: number;
  duration?: number;
}

interface D1Envelope<T> {
  success: boolean;
  errors: { code: number; message: string }[];
  messages: unknown[];
  result: Array<{ results: T[]; success: boolean; meta: D1QueryMeta }>;
}

function getCf() {
  const config = useRuntimeConfig();
  return (config.cf ?? {}) as {
    accountId?: string;
    apiToken?: string;
    d1DatabaseId?: string;
    kvNamespaceId?: string;
  };
}

/** 四项 CF 配置齐全才视为启用 */
export function isFileIndexEnabled(): boolean {
  const cf = getCf();
  return Boolean(cf.accountId && cf.apiToken && cf.d1DatabaseId && cf.kvNamespaceId);
}

/** 解析 public.fileIndexProviders（env 默认允许列表） */
export function getIndexProviders(): FileIndexProvider[] {
  const config = useRuntimeConfig();
  const raw = String(config.public.fileIndexProviders || ALL_PROVIDERS.join(","));
  const parsed = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is FileIndexProvider => (ALL_PROVIDERS as string[]).includes(s));
  return parsed.length ? parsed : [...ALL_PROVIDERS];
}

/** 执行一条 D1 SQL（务必用 ? 占位符 + params 绑定，防注入） */
export async function d1Query<T = Record<string, any>>(
  sql: string,
  params: unknown[] = []
): Promise<{ results: T[]; meta: D1QueryMeta }> {
  const cf = getCf();
  if (!cf.accountId || !cf.apiToken || !cf.d1DatabaseId) {
    throw createError({ statusCode: 503, message: "文件索引未配置" });
  }

  let res: D1Envelope<T>;
  try {
    res = await $fetch<D1Envelope<T>>(
      `${CF_API_BASE}/accounts/${cf.accountId}/d1/database/${cf.d1DatabaseId}/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${cf.apiToken}`, "Content-Type": "application/json" },
        body: { sql, params },
        timeout: 15000,
      }
    );
  } catch (err: any) {
    // CF/网络错误：完整细节只落服务端日志，对外统一 502，绝不回显 sql/token/上游状态
    console.error(
      "[d1Query] request error:",
      err?.message ?? err,
      "| cause:",
      err?.cause?.code ?? err?.cause?.message ?? err?.cause ?? "n/a",
      "| sql:",
      sql
    );
    throw createError({ statusCode: 502, message: "数据库请求失败（无法连接 Cloudflare）" });
  }

  if (!res.success) {
    console.error("[d1Query] failed:", res.errors?.[0]?.message, "| sql:", sql);
    throw createError({ statusCode: 502, message: "数据库查询失败" });
  }

  const first = res.result?.[0];
  return { results: first?.results ?? [], meta: first?.meta ?? {} };
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    file_type TEXT,
    url TEXT NOT NULL,
    tags TEXT,
    extra TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (provider, ref_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_files_provider ON files(provider)`,
  `CREATE INDEX IF NOT EXISTS idx_files_provider_created ON files(provider, created_at DESC)`,
];

let schemaReady = false;
/** 懒建表：首次写入时执行一次，使"可选安装"= 只填环境变量 */
export async function ensureFileIndexSchema(): Promise<void> {
  if (schemaReady) return;
  for (const sql of SCHEMA_STATEMENTS) {
    await d1Query(sql);
  }
  schemaReady = true;
}

/** KV 读取（失败/不存在返回 null，不阻断业务） */
export async function kvGet<T = any>(key: string): Promise<T | null> {
  const cf = getCf();
  if (!cf.accountId || !cf.apiToken || !cf.kvNamespaceId) return null;
  try {
    const res = await $fetch(
      `${CF_API_BASE}/accounts/${cf.accountId}/storage/kv/namespaces/${cf.kvNamespaceId}/values/${encodeURIComponent(key)}`,
      { headers: { Authorization: `Bearer ${cf.apiToken}` }, timeout: 10000 }
    );
    if (res == null) return null;
    if (typeof res === "string") {
      try {
        return JSON.parse(res) as T;
      } catch {
        return res as unknown as T;
      }
    }
    return res as T;
  } catch (err: any) {
    const status = err?.response?.status ?? err?.statusCode;
    if (status === 404) return null;
    console.error("[kvGet] error:", err?.message ?? err);
    return null;
  }
}

/** KV 写入（成功返回 true） */
export async function kvPut(key: string, value: unknown): Promise<boolean> {
  const cf = getCf();
  if (!cf.accountId || !cf.apiToken || !cf.kvNamespaceId) return false;
  try {
    await $fetch(
      `${CF_API_BASE}/accounts/${cf.accountId}/storage/kv/namespaces/${cf.kvNamespaceId}/values/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${cf.apiToken}` },
        body: typeof value === "string" ? value : JSON.stringify(value),
        timeout: 10000,
      }
    );
    return true;
  } catch (err: any) {
    console.error("[kvPut] error:", err?.message ?? err);
    return false;
  }
}
