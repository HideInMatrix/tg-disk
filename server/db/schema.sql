-- tg-disk 文件索引 D1 表结构
-- 手动初始化：wrangler d1 execute <db> --remote --file=./server/db/schema.sql
-- 应用首次写入时也会自动执行（见 server/utils/cloudflare.ts 的 ensureFileIndexSchema）

CREATE TABLE IF NOT EXISTS files (
  id         TEXT PRIMARY KEY,          -- server 生成 uuid
  provider   TEXT NOT NULL,             -- 'telegram' | 'crossbell' | 'r2'
  ref_id     TEXT NOT NULL,             -- file_id | cid | R2 object key
  file_name  TEXT,
  file_size  INTEGER,                   -- 客户端数值 file.size
  file_type  TEXT,                      -- resolveFilePreviewType 结果
  url        TEXT NOT NULL,             -- 检索路径, e.g. file/<id>
  tags       TEXT,                      -- JSON 数组字符串
  extra      TEXT,                      -- JSON: message_id, chat_id, cid ...
  created_at INTEGER NOT NULL,          -- epoch ms
  updated_at INTEGER NOT NULL,
  UNIQUE (provider, ref_id)             -- 幂等：重试/双发不产生重复行
);

CREATE INDEX IF NOT EXISTS idx_files_created          ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_provider         ON files(provider);
CREATE INDEX IF NOT EXISTS idx_files_provider_created ON files(provider, created_at DESC);
