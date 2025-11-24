import { defaultHeaders } from "~~/server/utils/defaultInfo";
import { fetchTelegramWithRetry, getFileInfo } from "~~/server/utils/telegram";

export default defineEventHandler(async (event) => {
  try {
    // 1. 读取表单数据
    const body = await readFormData(event);
    const config = useRuntimeConfig();
    console.log("我的配置", config);

    const chat_id = (body.get("chatId")?.toString() ?? "").trim();
    const functionType = (body.get("functionType") as string) ?? "document";
    const functionName = body.get("functionName")?.toString();
    const file = body.get("file") as Blob | null; // Here, we explicitly cast to Blob | null
    let fileName = body.get("fileName")?.toString();
    const caption = body.get("caption")?.toString();

    // 2. 基础校验
    if (!chat_id) throw new Error("chatId 必填");
    if (!functionName) throw new Error("functionName 必填");
    if (!file) throw new Error("文件必传"); // Ensure file exists
    if (!config.public.tgToken) throw new Error("Telegram Bot Token 未配置");

    // 3. 处理文件类型和文件名修改（对 GIF 和 WebP 进行处理）
    if (fileName) {
      const fileExt = fileName.split(".").pop()?.toLowerCase();

      if (fileExt === "gif" || fileExt === "webp" || fileExt === "svg") {
        fileName = fileName.replace(/\.(gif|webp)$/, ".jpeg"); // Rename to .jpeg
        const fileType = "image/jpeg"; // Change MIME type to jpeg

        // Ensure file is not null before creating a new File object
        if (file) {
          const newFile = new File([file], fileName, { type: fileType });
          body.set("file", newFile); // Update the FormData with new file
        }
      }
    }

    // 4. 组装 FormData
    const formData = new FormData();
    formData.append("chat_id", chat_id);

    // Ensure that file is not null when appending to formData
    if (file) {
      formData.append(functionType, file, fileName ?? "file");
    } else {
      throw new Error("文件数据无效");
    }

    if (caption) formData.append("caption", caption);

    // 5. 调用带重试的 Telegram 接口（默认最多重试 2 次，总共 3 次请求）
    const response = await fetchTelegramWithRetry(
      {
        token: config.public.tgToken,
        method: functionName,
        formData,
        headers: defaultHeaders,
        timeout: 20_000,
      },
      3, // 总尝试次数（可在这里改成 2、4...）
      10000, // 最小间隔 10s
      15000 // 最大间隔 15s
    );

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
