import { defaultHeaders } from "~~/server/utils/defaultInfo";
import { fetchTelegramWithRetry, getFileInfo } from "~~/server/utils/telegram";

export default defineEventHandler(async (event) => {
  try {
    // 1. 读取表单数据
    const body = await readFormData(event);
    const config = useRuntimeConfig();
    const tgToken = config.tgToken;

    const chat_id = (body.get("chatId")?.toString() ?? "").trim();

    const file = (body.get("file") as string) ?? ""; // Here, we explicitly cast to Blob | null
    const fileName = body.get("fileName")?.toString();
    const caption = body.get("caption")?.toString();

    if (!file || !fileName) {
      throw new Error("文件和文件名不能为空");
    }

    const fileInfo = getTelegramFileType(fileName);
    const functionType = fileInfo?.type ?? "document";
    const functionName = fileInfo?.method ?? "sendDocument";

    // 2. 基础校验
    if (!chat_id) throw new Error("chatId 必填");
    if (!functionName) throw new Error("functionName 必填");
    if (!file) throw new Error("文件地址必传"); // Ensure file exists
    if (!tgToken) throw new Error("Telegram Bot Token 未配置");

    const createTelegramFormData = (fieldName: string) => {
      const formData = new FormData();
      formData.append("chat_id", chat_id);
      formData.append(fieldName, file);
      if (caption) formData.append("caption", caption);
      return formData;
    };

    // 5. 调用带重试的 Telegram 接口
    let response;
    try {
      response = await fetchTelegramWithRetry({
        token: tgToken,
        method: functionName,
        formData: createTelegramFormData(functionType),
        headers: defaultHeaders,
        timeout: 20_000,
      });
    } catch (error: any) {
      if (functionName !== "sendPhoto") throw error;

      console.warn(
        "[telegram-upload] sendPhoto URL 转存失败，改用 sendDocument:",
        error?.message ?? error
      );

      response = await fetchTelegramWithRetry({
        token: tgToken,
        method: "sendDocument",
        formData: createTelegramFormData("document"),
        headers: defaultHeaders,
        timeout: 20_000,
      });
    }

    // 6. 成功返回
    return {
      msg: "ok",
      code: 200,
      data: getFileInfo(response),
    };
  } catch (error: any) {
    console.error("[telegram-upload] 请求失败:", error);

    // 根据业务需求返回统一错误结构
    return {
      msg: error?.message ?? "内部服务器错误",
      code: 500,
      data: null,
    };
  }
});
