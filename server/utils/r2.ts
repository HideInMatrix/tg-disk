import { AwsClient } from "aws4fetch";

// Cloudflare R2 走 S3 兼容 API（自托管无法用 bindings），用 aws4fetch 做 SigV4 签名。
// endpoint: https://<accountId>.r2.cloudflarestorage.com/<bucket>/<key>

function getR2() {
  const config = useRuntimeConfig();
  const cf = (config.cf ?? {}) as { accountId?: string };
  const r2 = (config.r2 ?? {}) as {
    accessKeyId?: string;
    secretAccessKey?: string;
    bucket?: string;
    endpoint?: string;
  };
  return { accountId: cf.accountId, ...r2 };
}

/** accountId + accessKeyId + secretAccessKey + bucket 齐全才视为启用 */
export function isR2Enabled(): boolean {
  const r = getR2();
  return Boolean(r.accountId && r.accessKeyId && r.secretAccessKey && r.bucket);
}

function r2Client() {
  const r = getR2();
  if (!r.accessKeyId || !r.secretAccessKey) {
    throw createError({ statusCode: 503, message: "R2 未配置" });
  }
  return new AwsClient({
    accessKeyId: r.accessKeyId,
    secretAccessKey: r.secretAccessKey,
    region: "auto",
    service: "s3",
  });
}

function objectUrl(key: string): string {
  const r = getR2();
  const base = r.endpoint || `https://${r.accountId}.r2.cloudflarestorage.com`;
  return `${base}/${r.bucket}/${key}`;
}

/** 上传对象；失败抛 502 */
export async function r2Put(
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<void> {
  let res: Response;
  try {
    res = await r2Client().fetch(objectUrl(key), {
      method: "PUT",
      body,
      headers: { "content-type": contentType },
    });
  } catch (err: any) {
    console.error(
      "[r2Put] request error:",
      err?.message ?? err,
      "| cause:",
      err?.cause?.code ?? err?.cause?.message ?? err?.cause ?? "n/a"
    );
    throw createError({ statusCode: 502, message: "R2 上传失败（无法连接）" });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[r2Put] failed", res.status, text.slice(0, 200));
    throw createError({ statusCode: 502, message: "R2 上传失败" });
  }
}

/** 读取对象，返回原始 Response（调用方负责流式转发/判断 ok） */
export async function r2Get(key: string): Promise<Response> {
  return r2Client().fetch(objectUrl(key), { method: "GET" });
}

/** 删除对象；成功或对象不存在返回 true */
export async function r2Delete(key: string): Promise<boolean> {
  try {
    const res = await r2Client().fetch(objectUrl(key), { method: "DELETE" });
    return res.ok || res.status === 404;
  } catch (err: any) {
    console.error("[r2Delete] error:", err?.message ?? err);
    return false;
  }
}
