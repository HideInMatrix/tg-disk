import { defaultHeaders } from "~~/server/utils/defaultInfo";
import {
  fetchTelegramWithRetry,
  getFileInfo,
  getTelegramFileType,
} from "~~/server/utils/telegram";
import { withUpload } from "~~/server/utils/concurrency";

export default defineEventHandler(async (event) => {
  try {
    const body = await readFormData(event);
    const config = useRuntimeConfig();
    const tgToken = config.tgToken;
    const TELEGRAM_MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

    const chat_id = (body.get("chatId")?.toString() ?? "").trim();

    const file = body.get("file") as Blob | null;
    const fileName = body.get("fileName")?.toString();
    const caption = body.get("caption")?.toString();

    if (!file || !fileName) {
      throw new Error("文件和文件名不能为空");
    }

    if (file.size > TELEGRAM_MAX_BYTES) {
      const sizeMiB = (file.size / (1024 * 1024)).toFixed(2);
      throw new Error(`Telegram 单文件上限 10 MiB（${TELEGRAM_MAX_BYTES} Bytes），当前文件 ${sizeMiB} MiB`);
    }

    const fileInfo = getTelegramFileType(fileName);
    const functionType = fileInfo?.type ?? "document";
    const functionName = fileInfo?.method ?? "sendDocument";

    // 1. 基础校验（尽量早失败，少做无用处理）
    if (!chat_id) throw new Error("chatId 必填");
    if (!functionName) throw new Error("functionName 必填");
    if (!file) throw new Error("文件必传");
    if (!tgToken) throw new Error("Telegram Bot Token 未配置");

    const createTelegramFormData = (fieldName: string, uploadFileName: string) => {
      const formData = new FormData();
      formData.append("chat_id", chat_id);
      formData.append(fieldName, file, uploadFileName);
      if (caption) formData.append("caption", caption);
      return formData;
    };

    // 4. 限制并发 + 带重试的 Telegram 调用
    const response = await withUpload(async () => {
      try {
        return await fetchTelegramWithRetry({
          token: tgToken,
          method: functionName!,
          formData: createTelegramFormData(functionType, fileName ?? "file"),
          headers: defaultHeaders,
          timeout: 30_000,
        });
      } catch (error: any) {
        if (functionName !== "sendPhoto") throw error;

        console.warn(
          "[telegram-upload] sendPhoto 失败，改用 sendDocument 上传原文件:",
          error?.message ?? error
        );

        return await fetchTelegramWithRetry({
          token: tgToken,
          method: "sendDocument",
          formData: createTelegramFormData("document", fileName ?? "file"),
          headers: defaultHeaders,
          timeout: 30_000,
        });
      }
    });

    return {
      msg: "ok",
      code: 200,
      data: getFileInfo(response),
    };
  } catch (error: any) {
    console.error("[telegram-upload] 请求失败:", error);

    return {
      msg: error?.message ?? "内部服务器错误",
      code: 500,
      data: null,
    };
  }
});
