// POST /api/r2/send — 服务端签名上传文件到 Cloudflare R2（S3 兼容 API）
export default defineEventHandler(async (event) => {
  try {
    if (!isR2Enabled()) throw createError({ statusCode: 503, message: "R2 未配置" });

    // 写入自己的存储桶属敏感操作：配置了账号密码时要求登录
    const config = useRuntimeConfig();
    const authRequired = Boolean(config.public.account && config.public.password);
    if (authRequired) await requireUserSession(event);

    const form = await readMultipartFormData(event);
    const filePart = form?.find((p) => p.name === "file");
    const fileNamePart = form?.find((p) => p.name === "fileName");
    if (!filePart?.data) throw createError({ statusCode: 400, message: "文件不能为空" });

    const fileName = fileNamePart?.data?.toString() || filePart.filename || "file";
    const dot = fileName.lastIndexOf(".");
    const ext = dot > 0 ? fileName.slice(dot) : "";
    const key = `${crypto.randomUUID()}${ext}`;
    const contentType = filePart.type || "application/octet-stream";

    await r2Put(key, filePart.data, contentType);

    return {
      code: 200,
      msg: "ok",
      data: { file_id: key, file_name: fileName, file_size: filePart.data.length },
    };
  } catch (err: any) {
    console.error("[r2-upload] 失败:", err?.message ?? err);
    return { code: err?.statusCode || 500, msg: err?.message || "上传失败", data: null };
  }
});
