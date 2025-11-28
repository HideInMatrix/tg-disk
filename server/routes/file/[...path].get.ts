import { createError } from "h3";
import { defaultHeaders } from "#imports";
import axios from "axios";
import http from "node:http";
import https from "node:https";
import { join } from "node:path";
import { createReadStream } from "node:fs";
import { withFileDownload, withRemoteFetch } from "~~/server/utils/concurrency";

// 带 keep-alive 的 axios 实例，复用连接
const remoteClient = axios.create({
  timeout: 20_000,
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: 100 }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 100 }),
});

function getMimeType(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    pdf: "application/pdf",
    mp3: "audio/mpeg",
  };
  return map[ext || ""] || null;
}

export default defineEventHandler(async (event) => {
  const envConfig = useRuntimeConfig();
  const params = getRouterParams(event);
  const rawPath = params.path;
  const fileId = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;

  if (!fileId) {
    throw createError({ statusCode: 400, message: "file_id 必传" });
  }

  const isFilePath = fileId.match(/\.(png|jpg|jpeg|gif|webp|mp4|pdf|mp3)$/i);
  let fileUrl: string | undefined;
  let fileName = "file";

  if (isFilePath) {
    fileUrl = `https://telegra.ph/file/${fileId}`;
  } else {
    // 这里就不要把错误静默处理了，直接抛出去
    const infoResp = await withRemoteFetch(() =>
      remoteClient.get(
        `https://api.telegram.org/bot${envConfig.public.tgToken}/getFile`,
        {
          params: { file_id: fileId },
          headers: defaultHeaders,
        }
      )
    );

    if (!infoResp || !infoResp.data) {
      throw createError({ statusCode: 502, message: "无法获取文件信息" });
    }

    const filePath = infoResp.data?.result.file_path;

    if (!filePath) {
      throw createError({ statusCode: 404, message: "file_path 未找到" });
    }

    fileUrl = `https://api.telegram.org/file/bot${envConfig.public.tgToken}/${filePath}`;
    fileName = filePath.split("/").pop() || "file";
  }

  try {
    if (!fileUrl) {
      const filePath = join(process.cwd(), "public/404.webp");
      setHeader(event, "Content-Type", "image/webp");
      setHeader(event, "Cache-Control", "public, max-age=0");
      return sendStream(event, createReadStream(filePath));
    }

    const response = await withFileDownload(() =>
      remoteClient.get(fileUrl!, {
        headers: {
          ...defaultHeaders,
          Referer: isFilePath
            ? "https://telegra.ph/"
            : "https://api.telegram.com/",
        },
        responseType: "stream",
      })
    );

    const contentType =
      getMimeType(fileName) ||
      response.headers["content-type"] ||
      "application/octet-stream";

    setHeader(event, "Content-Type", contentType);
    // 真要缓存一天的话：
    setHeader(event, "Cache-Control", "public, max-age=86400");

    return sendStream(event, response.data);
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw createError({ statusCode: 504, message: "Telegram timeout" });
    }
    if (err.code === "UND_ERR_CONNECT_TIMEOUT") {
      throw createError({
        statusCode: 504,
        message: "Connect to Telegram timeout",
      });
    }

    console.error(
      "Telegram 代理接口错误:",
      err?.response?.status,
      err?.message
    );
    throw createError({
      statusCode: err.response?.status || 502,
      message: "Bad gateway",
    });
  }
});
