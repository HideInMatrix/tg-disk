import type { H3Event } from "h3";

// KV 中存运行时 provider 开关
const SETTINGS_KEY = "file-index:settings";
// D1 单条 SQL 绑定参数上限 100；files 表 11 列 → 每批最多 9 行
const INSERT_COLS = 11;
const MAX_ROWS_PER_INSERT = Math.floor(100 / INSERT_COLS); // = 9

interface FileRow {
  id: string;
  provider: FileIndexProvider;
  ref_id: string;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  url: string;
  tags: string | null;
  extra: string | null;
  created_at: number;
  updated_at: number;
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function parseRow(row: FileRow): FileRecord {
  return {
    id: row.id,
    provider: row.provider,
    ref_id: row.ref_id,
    file_name: row.file_name ?? "",
    file_size: row.file_size,
    file_type: row.file_type,
    url: row.url,
    tags: safeJson<string[]>(row.tags, []),
    extra: safeJson<Record<string, any>>(row.extra, {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** 校验功能启用（503）+ 鉴权（authRequired 时要求登录，401）——沿用现有可选鉴权 idiom */
export async function assertFileIndex(event: H3Event): Promise<void> {
  if (!isFileIndexEnabled()) {
    throw createError({ statusCode: 503, message: "文件索引未启用" });
  }
  const config = useRuntimeConfig();
  const authRequired = Boolean(config.public.account && config.public.password);
  if (authRequired) {
    await requireUserSession(event);
  }
}

/** 当前受管 provider：KV 运行时设置 ∩ env 允许列表；无 KV 设置时取 env 允许列表 */
export async function getManagedProviders(): Promise<FileIndexProvider[]> {
  const allowed = getIndexProviders();
  const settings = await kvGet<FileIndexSettings>(SETTINGS_KEY);
  if (settings && Array.isArray(settings.providers)) {
    return settings.providers.filter((p) => allowed.includes(p));
  }
  return allowed;
}

/** 保存运行时 provider 开关（只保留 env 允许列表内的项） */
export async function saveManagedProviders(providers: FileIndexProvider[]): Promise<FileIndexProvider[]> {
  const allowed = getIndexProviders();
  const filtered = allowed.filter((p) => providers.includes(p));
  await kvPut(SETTINGS_KEY, { providers: filtered } as FileIndexSettings);
  return filtered;
}

/** 记录上传（幂等：ON CONFLICT DO NOTHING）；返回新插入行数 */
export async function recordFiles(payloads: RecordFilePayload[]): Promise<number> {
  const managed = await getManagedProviders();
  const valid = (payloads || []).filter(
    (p) => p && p.provider && p.ref_id && p.url && managed.includes(p.provider)
  );
  if (!valid.length) return 0;

  await ensureFileIndexSchema();
  const now = Date.now();
  let inserted = 0;

  for (let i = 0; i < valid.length; i += MAX_ROWS_PER_INSERT) {
    const chunk = valid.slice(i, i + MAX_ROWS_PER_INSERT);
    const placeholders = chunk.map(() => `(?,?,?,?,?,?,?,?,?,?,?)`).join(",");
    const params: unknown[] = [];
    for (const p of chunk) {
      params.push(
        crypto.randomUUID(),
        p.provider,
        p.ref_id,
        p.file_name ?? null,
        typeof p.file_size === "number" ? p.file_size : null,
        p.file_type ?? null,
        p.url,
        JSON.stringify([]),
        JSON.stringify(p.extra ?? {}),
        now,
        now
      );
    }
    const { meta } = await d1Query(
      `INSERT INTO files (id, provider, ref_id, file_name, file_size, file_type, url, tags, extra, created_at, updated_at)
       VALUES ${placeholders}
       ON CONFLICT(provider, ref_id) DO NOTHING`,
      params
    );
    inserted += meta.changes ?? 0;
  }

  return inserted;
}

/** 分页 + 过滤 + 文件名搜索 */
export async function listFiles(opts: {
  page?: number;
  pageSize?: number;
  provider?: string;
  q?: string;
}): Promise<FileListResult> {
  await ensureFileIndexSchema();
  const managed = await getManagedProviders();

  const page = Math.max(1, Number(opts.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(opts.pageSize) || 20));

  let providers = managed;
  if (opts.provider && opts.provider !== "all") {
    providers = managed.filter((p) => p === opts.provider);
  }
  if (!providers.length) {
    return { items: [], total: 0, page, pageSize, hasMore: false };
  }

  const where: string[] = [`provider IN (${providers.map(() => "?").join(",")})`];
  const params: unknown[] = [...providers];
  if (opts.q) {
    where.push(`file_name LIKE ?`);
    params.push(`%${opts.q}%`);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const countRes = await d1Query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM files ${whereSql}`,
    params
  );
  const total = Number(countRes.results?.[0]?.total ?? 0);

  const offset = (page - 1) * pageSize;
  const rowsRes = await d1Query<FileRow>(
    `SELECT * FROM files ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const items = rowsRes.results.map(parseRow);

  return { items, total, page, pageSize, hasMore: offset + items.length < total };
}

export async function getFileById(id: string): Promise<FileRecord | null> {
  await ensureFileIndexSchema();
  const res = await d1Query<FileRow>(`SELECT * FROM files WHERE id = ? LIMIT 1`, [id]);
  const row = res.results?.[0];
  return row ? parseRow(row) : null;
}

/** 重命名 / 标签 */
export async function updateFile(id: string, patch: UpdateFilePayload): Promise<FileRecord | null> {
  const managed = await getManagedProviders();
  const existing = await getFileById(id);
  if (!existing || !managed.includes(existing.provider)) return null;

  const sets: string[] = [];
  const params: unknown[] = [];
  if (typeof patch.file_name === "string") {
    sets.push("file_name = ?");
    params.push(patch.file_name);
  }
  if (Array.isArray(patch.tags)) {
    sets.push("tags = ?");
    params.push(JSON.stringify(patch.tags));
  }
  if (!sets.length) return existing;

  sets.push("updated_at = ?");
  params.push(Date.now(), id);

  await d1Query(`UPDATE files SET ${sets.join(", ")} WHERE id = ?`, params);
  return getFileById(id);
}

/** 删除：移除索引记录；Telegram 尽力删除消息，IPFS 仅移除记录 */
export async function deleteFile(id: string): Promise<{ deleted: boolean; note?: string }> {
  const managed = await getManagedProviders();
  const record = await getFileById(id);
  if (!record || !managed.includes(record.provider)) {
    return { deleted: false };
  }

  let note: string | undefined;
  if (record.provider === "telegram") {
    const config = useRuntimeConfig();
    const token = config.tgToken as string | undefined;
    const chatId = record.extra?.chat_id;
    const messageId = record.extra?.message_id;
    if (token && chatId != null && messageId != null) {
      const ok = await deleteTelegramMessage(token, chatId, Number(messageId));
      if (!ok) note = "Telegram 消息删除失败，但索引记录已移除";
    } else {
      note = "缺少 message_id，无法删除 Telegram 消息，仅移除索引记录";
    }
  } else if (record.provider === "r2") {
    const ok = await r2Delete(record.ref_id);
    if (!ok) note = "R2 对象删除失败，但索引记录已移除";
  } else {
    note = "IPFS 内容不可控，仅移除索引记录（内容可能仍可通过网关访问）";
  }

  await d1Query(`DELETE FROM files WHERE id = ?`, [id]);
  return { deleted: true, note };
}
