import { TelegramFileType } from "~~/shared/telegram";

interface TelegramOptions {
  token: string;
  method: string;
  formData: FormData;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * 带自动重试的 Telegram Bot API 请求
 * @param options
 * @param retries 默认重试次数（包括第一次请求在内算 1 次）
 * @param minDelayMs 最小延迟（ms）
 * @param maxDelayMs 最大延迟（ms）
 */
export async function fetchTelegramWithRetry(
  options: TelegramOptions,
  retries = 5, // 总共尝试 3 次（1 次原始 + 2 次重试）
  minDelayMs = 10000, // 10s
  maxDelayMs = 15000 // 15s
): Promise<any> {
  let lastError: any;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await $fetch(
        `https://api.telegram.org/bot${options.token}/${options.method}`,
        {
          method: "POST",
          body: options.formData,
          headers: options.headers ?? {},
          timeout: options.timeout ?? 20_000,
        }
      );

      // Telegram 返回 { ok: false, error_code: xxx, description: '...' } 时也需要抛错
      if (response && typeof response === "object" && !(response as any).ok) {
        throw new Error(
          `Telegram error ${(response as any).error_code}: ${
            (response as any).description
          }`
        );
      }

      return response;
    } catch (err: any) {
      lastError = err;

      // 已经是最后一次尝试，直接抛出
      if (attempt === retries) break;

      // 随机延迟 10~15 秒
      const delay = minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
      console.warn(
        `[Telegram] 第 ${attempt} 次请求失败，${delay / 1000}s 后重试...`,
        err.message || err
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // 所有尝试都失败
  throw lastError;
}

/**
 * 获取文件信息
 * @param {Object} responseData - Telegram API响应数据
 * @returns {Object|null} 文件信息对象或null
 */
export function getFileInfo(responseData: {
  ok: any;
  description: any;
  result: { photo: any[]; video: any; audio: any; document: any };
}) {
  const getFileDetails = (file: {
    file_id: any;
    file_name: any;
    file_unique_id: any;
    file_size: any;
  }) => ({
    file_id: file.file_id,
    file_name: file.file_name || file.file_unique_id,
    file_size: file.file_size,
  });

  try {
    if (!responseData.ok) {
      console.error("Telegram API error:", responseData.description);
      return null;
    }

    if (responseData.result.photo) {
      const largestPhoto = responseData.result.photo.reduce((prev, current) =>
        prev.file_size > current.file_size ? prev : current
      );
      return getFileDetails(largestPhoto);
    }

    if (responseData.result.video) {
      return getFileDetails(responseData.result.video);
    }

    if (responseData.result.audio) {
      return getFileDetails(responseData.result.audio);
    }

    if (responseData.result.document) {
      return getFileDetails(responseData.result.document);
    }

    return null;
  } catch (error: any) {
    console.error("Error parsing Telegram response:", error.message);
    return null;
  }
}

export function getTelegramFileType(
  file: File | string
): TelegramFileType | undefined {
  // 判断 file 是否是 URL 字符串
  if (typeof file === "string") {
    const ext = file.split(".").pop()?.toLowerCase();
    const fileName = file.split("/").pop()?.split("?")[0] || "unknown";

    // 判断 URL 后缀来确定文件类型
    if (ext) {
      if (["jpg", "jpeg", "png", "gif"].includes(ext)) {
        return ext === "gif"
          ? { type: "animation", method: "sendAnimation", fileName }
          : { type: "photo", method: "sendPhoto", fileName };
      }
      if (["mp3", "ogg", "wav"].includes(ext)) {
        return { type: "audio", method: "sendAudio", fileName };
      }
      if (["mp4", "mov", "avi"].includes(ext)) {
        return { type: "video", method: "sendVideo", fileName };
      }
      // 默认返回 document
      return { type: "document", method: "sendDocument", fileName };
    }
  } else {
    // 如果是 File 对象
    const ext = file.name.split(".").pop()?.toLowerCase();
    const mime = file.type.toLowerCase();

    if (mime.includes("image")) {
      return ext === "gif"
        ? { type: "animation", method: "sendAnimation", fileName: file.name }
        : { type: "photo", method: "sendPhoto", fileName: file.name };
    }
    if (mime.includes("audio"))
      return { type: "audio", method: "sendAudio", fileName: file.name };
    if (mime.includes("video"))
      return { type: "video", method: "sendVideo", fileName: file.name };
    return { type: "document", method: "sendDocument", fileName: file.name };
  }

  // 如果没有匹配的类型，返回 undefined
  return undefined;
}
