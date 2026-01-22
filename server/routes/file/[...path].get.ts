import { createError } from "h3";
import { defaultHeaders } from "#imports";
import { withFileDownload, withRemoteFetch } from "~~/server/utils/concurrency";
import { getMimeType } from "~~/server/utils/fileType";


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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    let infoResp;
    try {
      infoResp = await withRemoteFetch(() =>
        fetch(
          `https://api.telegram.org/bot${envConfig.public.tgToken}/getFile?file_id=${fileId}`,
          {
            method: "GET",
            headers: defaultHeaders,
            signal: controller.signal,
          }
        )
      );
    } finally {
      clearTimeout(timeoutId);
    }
    if (!infoResp.ok) {
      throw createError({ statusCode: 502, message: "无法获取文件信息" });
    }
    const data = await infoResp.json();
    if (!data) {
      throw createError({ statusCode: 502, message: "无法获取文件信息" });
    }
    const filePath = data?.result.file_path;
    if (!filePath) {
      throw createError({ statusCode: 404, message: "file_path 未找到" });
    }
    fileUrl = `https://api.telegram.org/file/bot${envConfig.public.tgToken}/${filePath}`;
    fileName = filePath.split("/").pop() || "file";
  }
  try {
    if (!fileUrl) {
      const response = await fetch("https://4c552a81.pinit.eth.limo");
      if (!response.ok) {
        // 如果外部图片加载失败，你可以返回 404 或 500
        throw createError({
          statusCode: 404,
          statusMessage: "Placeholder image not found",
        });
      }
      setHeader(event, "Content-Type", "image/webp");
      setHeader(event, "Cache-Control", "public, max-age=0");
      return sendStream(event, response.body as ReadableStream);
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    let response;
    try {
      response = await withFileDownload(() =>
        fetch(fileUrl!, {
          method: "GET",
          headers: {
            ...defaultHeaders,
            Referer: isFilePath
              ? "https://telegra.ph/"
              : "https://api.telegram.com/",
          },
          signal: controller.signal,
        })
      );
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      throw createError({
        statusCode: response.status || 502,
        message: "Bad gateway",
      });
    }
    const contentType =
      getMimeType(fileName) ||
      response.headers.get("content-type") ||
      "application/octet-stream";
    setHeader(event, "Content-Type", contentType);
    // 真要缓存一天的话：
    setHeader(event, "Cache-Control", "public, max-age=86400");
    return sendStream(event, response.body as ReadableStream);
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw createError({ statusCode: 504, message: "Telegram timeout" });
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
