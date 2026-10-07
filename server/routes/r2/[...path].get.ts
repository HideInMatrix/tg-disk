import { createError } from "h3";
import { getMimeType } from "~~/server/utils/fileType";

// GET /r2/<key> — 通过原生绑定或 S3 从 R2 拉取对象并流式转发（兼容私有桶）
export default defineEventHandler(async (event) => {
  if (!isR2Enabled(event)) throw createError({ statusCode: 503, message: "R2 未配置" });

  const params = getRouterParams(event);
  const rawPath = params.path;
  const key = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;
  if (!key) throw createError({ statusCode: 400, message: "key 必传" });

  const res = await r2Get(key, event);
  if (!res.ok || !res.body) {
    throw createError({ statusCode: res.status === 404 ? 404 : 502, message: "文件不存在" });
  }

  const contentType =
    res.headers.get("content-type") || getMimeType(key) || "application/octet-stream";
  setHeader(event, "Content-Type", contentType);
  const len = res.headers.get("content-length");
  if (len) setHeader(event, "Content-Length", len);
  const etag = res.headers.get("etag");
  if (etag) setHeader(event, "ETag", etag);
  setHeader(event, "Cache-Control", "public, max-age=86400");

  return sendStream(event, res.body as ReadableStream);
});
