import type { H3Event } from "h3";
import { AwsClient } from "aws4fetch";

interface R2BoundObject {
  body: ReadableStream<Uint8Array>;
  size: number;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}

interface R2BucketBinding {
  put(key: string, body: Uint8Array, options: { httpMetadata: { contentType: string } }): Promise<unknown>;
  get(key: string): Promise<R2BoundObject | null>;
  delete(key: string): Promise<void>;
}

/** Nitro 2 的 Pages/Workers 绑定来自当前请求，不能从全局 runtimeConfig 读取。 */
function getR2Binding(event?: H3Event): R2BucketBinding | null {
  const env = event?.context.cloudflare?.env;
  for (const name of ["NUXT_R2_BUCKET", "R2_BUCKET"]) {
    const bucket = env?.[name];
    if (bucket && typeof bucket.put === "function" && typeof bucket.get === "function" && typeof bucket.delete === "function") {
      return bucket as R2BucketBinding;
    }
  }
  return null;
}

/** 自托管/普通 Node 环境仍可通过 S3 兼容 API 访问 R2。 */
function getR2(event?: H3Event) {
  const config = useRuntimeConfig(event);
  const cf = (config.cf ?? {}) as { accountId?: string };
  const r2 = (config.r2 ?? {}) as {
    accessKeyId?: string;
    secretAccessKey?: string;
    bucket?: unknown;
    endpoint?: string;
  };
  return {
    accountId: cf.accountId,
    ...r2,
    // 同名 Pages 绑定是对象，不是可插入 S3 URL 的桶名字符串。
    bucket: typeof r2.bucket === "string" ? r2.bucket.trim() : "",
  };
}

/** 原生绑定即可启用；只有自托管 S3 模式需要账户 ID、密钥对和桶名。 */
export function isR2Enabled(event?: H3Event): boolean {
  if (getR2Binding(event)) return true;
  const r = getR2(event);
  return Boolean(r.accountId && r.accessKeyId && r.secretAccessKey && r.bucket);
}

function r2Client(event?: H3Event) {
  const r = getR2(event);
  if (!r.accountId || !r.accessKeyId || !r.secretAccessKey || !r.bucket) {
    throw createError({ statusCode: 503, message: "R2 未配置" });
  }
  return new AwsClient({
    accessKeyId: r.accessKeyId,
    secretAccessKey: r.secretAccessKey,
    region: "auto",
    service: "s3",
  });
}

function objectUrl(key: string, event?: H3Event): string {
  const r = getR2(event);
  const base = (r.endpoint || `https://${r.accountId}.r2.cloudflarestorage.com`).replace(/\/$/, "");
  return `${base}/${encodeURIComponent(r.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** 优先使用原生绑定上传，失败不回退到另一个存储目标。 */
export async function r2Put(
  key: string,
  body: Uint8Array,
  contentType: string,
  event?: H3Event
): Promise<void> {
  let res: Response;
  try {
    const bucket = getR2Binding(event);
    if (bucket) {
      await bucket.put(key, body, { httpMetadata: { contentType } });
      return;
    }
    res = await r2Client(event).fetch(objectUrl(key, event), {
      method: "PUT",
      body,
      headers: { "content-type": contentType },
    });
  } catch (err: any) {
    console.error("[r2Put] request error:", err?.message ?? err);
    throw createError({ statusCode: 502, message: "R2 上传失败" });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[r2Put] failed", res.status, text.slice(0, 200));
    throw createError({ statusCode: 502, message: "R2 上传失败" });
  }
}

/** 统一返回 Response，保留原生绑定的流式 body 和 HTTP 元数据。 */
export async function r2Get(key: string, event?: H3Event): Promise<Response> {
  try {
    const bucket = getR2Binding(event);
    if (bucket) {
      const object = await bucket.get(key);
      if (!object) return new Response(null, { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("Content-Length", String(object.size));
      headers.set("ETag", object.httpEtag);
      return new Response(object.body, { headers });
    }
    return await r2Client(event).fetch(objectUrl(key, event), { method: "GET" });
  } catch (err: any) {
    console.error("[r2Get] request error:", err?.message ?? err);
    throw createError({ statusCode: 502, message: "R2 读取失败" });
  }
}

/** 原生绑定和 S3 模式都支持删除；不存在的对象也视为删除成功。 */
export async function r2Delete(key: string, event?: H3Event): Promise<boolean> {
  try {
    const bucket = getR2Binding(event);
    if (bucket) {
      await bucket.delete(key);
      return true;
    }
    const res = await r2Client(event).fetch(objectUrl(key, event), { method: "DELETE" });
    return res.ok || res.status === 404;
  } catch (err: any) {
    console.error("[r2Delete] error:", err?.message ?? err);
    return false;
  }
}
