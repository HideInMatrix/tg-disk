import { defaultHeaders } from "~~/server/utils/defaultInfo";
import { fetchTelegramWithRetry, getFileInfo } from "~~/server/utils/telegram";
import { withUpload } from "~~/server/utils/concurrency";

export default defineEventHandler(async (event) => {
  try {
    const body = await readFormData(event);
    const config = useRuntimeConfig();

    const chat_id = (body.get("chatId")?.toString() ?? "").trim();
    const functionType = (body.get("functionType") as string) ?? "document";
    const functionName = body.get("functionName")?.toString();
    const file = body.get("file") as Blob | null;
    let fileName = body.get("fileName")?.toString();
    const caption = body.get("caption")?.toString();

    // 1. 基础校验（尽量早失败，少做无用处理）
    if (!chat_id) throw new Error("chatId 必填");
    if (!functionName) throw new Error("functionName 必填");
    if (!file) throw new Error("文件必传");
    if (!config.public.tgToken) throw new Error("Telegram Bot Token 未配置");

    // 2. 只调整文件名，不再复制 Blob 数据
    if (fileName) {
      const fileExt = fileName.split(".").pop()?.toLowerCase();

      // 这里只是给 Telegram “看起来像 jpeg”
      if (fileExt === "gif" || fileExt === "webp" || fileExt === "svg") {
        fileName = fileName.replace(/\.(gif|webp|svg)$/i, ".jpeg");
      }
    }

    // 3. 重新组装发送给 Telegram 的 FormData
    const formData = new FormData();
    formData.append("chat_id", chat_id);

    // 注意：FormData.append(name, blob, filename) 第三个参数会覆盖文件名
    formData.append(functionType, file, fileName ?? "file");

    if (caption) formData.append("caption", caption);

    // 4. 限制并发 + 带重试的 Telegram 调用
    const response = await withUpload(() =>
      fetchTelegramWithRetry(
        {
          token: config.public.tgToken,
          method: functionName!,
          formData,
          headers: defaultHeaders,
          timeout: 20_000,
        },
        3,
        10_000,
        15_000
      )
    );

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
