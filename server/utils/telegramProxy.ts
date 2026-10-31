import { createError } from "h3";
import { getMimeType } from "./fileType";

interface ProxyOptions {
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  infoTimeoutMs?: number;
  downloadTimeoutMs?: number;
  metadataTtlMs?: number;
  maxMetadataEntries?: number;
}

interface FileMetadata {
  path: string;
  expiresAt: number;
}

/** Keep deadlines active through body consumption, not just until fetch resolves headers. */
function deadline(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
    abort: () => { clearTimeout(timer); controller.abort(); },
  };
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => {});
    return Promise.reject(createError({ statusCode: 504, message: "Telegram 上游超时" }));
  }
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(createError({ statusCode: 504, message: "Telegram 上游超时" }));
    };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener("abort", abort); resolve(value); },
      (error) => { signal.removeEventListener("abort", abort); reject(error); },
    );
  });
}

/** A fresh stream per request. Never put Response/ReadableStream/IO promises in a global map. */
function boundedBody(body: ReadableStream<Uint8Array>, limit: ReturnType<typeof deadline>) {
  const reader = body.getReader();
  let ended = false;
  const finish = () => {
    ended = true;
    limit.clear();
    limit.signal.removeEventListener("abort", abort);
  };
  let abort = () => {};
  return new ReadableStream<Uint8Array>({
    start(controller) {
      abort = () => {
        if (ended) return;
        finish();
        controller.error(createError({ statusCode: 504, message: "Telegram 正文读取超时" }));
        void reader.cancel().catch(() => {});
      };
      limit.signal.addEventListener("abort", abort, { once: true });
      if (limit.signal.aborted) abort();
    },
    async pull(controller) {
      try {
        const part = await reader.read();
        if (ended) return;
        if (part.done) { finish(); controller.close(); }
        else controller.enqueue(part.value);
      } catch {
        if (ended) return;
        finish();
        controller.error(createError({ statusCode: 502, message: "Telegram 正文读取失败" }));
        void reader.cancel().catch(() => {});
      }
    },
    cancel(reason) {
      if (!ended) { finish(); limit.abort(); }
      return reader.cancel(reason).catch(() => {});
    },
  });
}

function discard(response: Response) {
  // An upstream cancellation must not itself become an unbounded wait.
  void response.body?.cancel().catch(() => {});
}

function upstreamError(status: number, info = false) {
  const statusCode = status === 404 || (info && status === 400) ? 404
    : status === 429 ? 503
    : [408, 504, 524].includes(status) ? 504 : 502;
  return createError({ statusCode, message: statusCode === 404 ? "文件不存在" : "Telegram 上游暂不可用" });
}

/**
 * Cache only completed metadata values, scoped by Bot token. Media bytes stay streamed.
 * No process-wide download semaphore: a Pages isolate handles multiple independent invocations.
 */
export function createTelegramFileProxy(options: ProxyOptions = {}) {
  const request = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const now = options.now ?? Date.now;
  const metadata = new Map<string, FileMetadata>();
  const infoTimeout = options.infoTimeoutMs ?? 15_000;
  const downloadTimeout = options.downloadTimeoutMs ?? 30_000;
  const metadataTtl = options.metadataTtlMs ?? 45 * 60_000;
  const maxEntries = options.maxMetadataEntries ?? 512;

  async function lookup(token: string, id: string, key: string): Promise<string> {
    const limit = deadline(infoTimeout);
    try {
      const response = await abortable(request(
        `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(id)}`,
        { signal: limit.signal },
      ), limit.signal);
      if (!response.ok) { await discard(response); throw upstreamError(response.status, true); }
      if (!response.body) throw createError({ statusCode: 502, message: "Telegram 文件信息为空" });
      const data = await new Response(boundedBody(response.body, limit)).json();
      if (!data?.ok) throw upstreamError(Number(data?.error_code) || 502, true);
      const path = data?.result?.file_path;
      if (typeof path !== "string" || !path || path.startsWith("/") || path.split("/").includes("..")) {
        throw createError({ statusCode: 502, message: "Telegram 文件路径无效" });
      }
      // Bounded LRU; never retain errors, secrets in diagnostics, or pending fetches.
      metadata.delete(key);
      metadata.set(key, { path, expiresAt: now() + metadataTtl });
      while (metadata.size > maxEntries) metadata.delete(metadata.keys().next().value!);
      return path;
    } catch (error: any) {
      if (limit.signal.aborted) throw createError({ statusCode: 504, message: "Telegram 文件信息请求超时" });
      if (error?.statusCode) throw error;
      // Native network error messages may embed the Bot token in their URL. Do not forward/log them.
      throw createError({ statusCode: 502, message: "Telegram 文件信息请求失败" });
    } finally { limit.clear(); }
  }

  return async (fileId: string, token: string, cloudflare = false): Promise<Response> => {
    if (!fileId) throw createError({ statusCode: 400, message: "file_id 必传" });
    const legacy = /\.(png|jpg|jpeg|gif|webp|mp4|pdf|mp3)$/i.test(fileId);
    if (!legacy && !token) throw createError({ statusCode: 503, message: "Telegram Bot Token 未配置" });
    if (fileId.split("/").some((part) => !part || part === "." || part === "..")) {
      throw createError({ statusCode: 400, message: "文件路径无效" });
    }
    const infoStarted = now();
    const key = `${token}\0${fileId}`;
    let cached = legacy ? undefined : metadata.get(key);
    if (cached && cached.expiresAt <= now()) { metadata.delete(key); cached = undefined; }
    if (cached) { metadata.delete(key); metadata.set(key, cached); }
    let cacheStatus = cached ? "HIT" : "MISS";
    let path = legacy ? fileId : cached?.path ?? await lookup(token, fileId, key);

    const infoDuration = () => Math.max(0, now() - infoStarted);
    // Refresh an expired/revoked cached download path once, never retry indefinitely.
    for (let attempt = 0; attempt < 2; attempt++) {
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      const url = legacy ? `https://telegra.ph/file/${encodedPath}`
        : `https://api.telegram.org/file/bot${token}/${encodedPath}`;
      const limit = deadline(downloadTimeout);
      const headerStarted = now();
      const metadataDuration = infoDuration();
      try {
        const init: RequestInit & { cf?: object } = {
          signal: limit.signal,
          headers: { Referer: legacy ? "https://telegra.ph/" : "https://api.telegram.org/" },
        };
        // Let Cloudflare cache the upstream bytes without buffering/teeing them in isolate memory.
        // Only 200 is cacheable; errors must never be cached. The site's anti-hotlink middleware
        // still runs before every proxy request, including an upstream cache hit.
        if (cloudflare) init.cf = { cacheEverything: true, cacheTtlByStatus: { "200": 86400, "201-599": -1 } };
        const response = await abortable(request(url, init), limit.signal);
        if (!response.ok) {
          await discard(response);
          limit.clear();
          if (!legacy && [403, 404].includes(response.status)) metadata.delete(key);
          if (!legacy && cached && attempt === 0 && [403, 404].includes(response.status)) {
            path = await lookup(token, fileId, key);
            cached = undefined;
            cacheStatus = "REFRESH";
            continue;
          }
          throw upstreamError(response.status);
        }
        if (!response.body) throw createError({ statusCode: 502, message: "Telegram 文件正文为空" });
        const headers = new Headers({
          "Content-Type": getMimeType(path) || response.headers.get("Content-Type") || "application/octet-stream",
          "Cache-Control": "public, max-age=86400",
          "X-TG-Metadata-Cache": cacheStatus,
          "Server-Timing": `tg_meta;dur=${metadataDuration}, tg_headers;dur=${Math.max(0, now() - headerStarted)}`,
          "X-Content-Type-Options": "nosniff",
        });
        for (const name of ["ETag", "Last-Modified"]) {
          const value = response.headers.get(name);
          if (value) headers.set(name, value);
        }
        // fetch can decode compressed bodies; don't forward an obsolete compressed byte count.
        const size = response.headers.get("Content-Length");
        if (size && !response.headers.has("Content-Encoding")) headers.set("Content-Length", size);
        const upstreamCache = response.headers.get("CF-Cache-Status");
        if (upstreamCache) headers.set("X-TG-Upstream-Cache", upstreamCache);
        return new Response(boundedBody(response.body, limit), { headers });
      } catch (error: any) {
        limit.abort();
        if (error?.statusCode) throw error;
        if (error?.name === "AbortError") throw createError({ statusCode: 504, message: "Telegram 文件下载超时" });
        throw createError({ statusCode: 502, message: "Telegram 文件下载失败" });
      }
    }
    throw createError({ statusCode: 502, message: "Telegram 文件下载失败" });
  };
}
