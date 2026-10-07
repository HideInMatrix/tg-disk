// Cloudflare D1 文件索引相关类型（全局环境声明，server 与 app 均可直接使用）

// 纳入索引/管理的上传方式
type FileIndexProvider = "telegram" | "crossbell" | "r2";

// D1 files 表的一行（tags/extra 已从 JSON 字符串解析为对象）
interface FileRecord {
  id: string;
  provider: FileIndexProvider;
  ref_id: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  url: string;
  tags: string[];
  extra: Record<string, any>;
  created_at: number;
  updated_at: number;
}

// 前端上传成功后调用 POST /api/files 的载荷
interface RecordFilePayload {
  provider: FileIndexProvider;
  ref_id: string;
  url: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  extra?: Record<string, any>;
}

// 列表接口返回
interface FileListResult {
  items: FileRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// PATCH /api/files/:id 的载荷
interface UpdateFilePayload {
  file_name?: string;
  tags?: string[];
}

// KV 中的运行时设置
interface FileIndexSettings {
  providers: FileIndexProvider[];
}
