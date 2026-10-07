// POST /api/files — 记录一次或多次上传（前端上传成功后调用；幂等）
export default defineEventHandler(async (event) => {
  await assertFileIndex(event);
  const body = await readBody(event);
  const payloads: RecordFilePayload[] = Array.isArray(body) ? body : [body];

  // 防滥用：限制单次批量数量
  if (payloads.length > 100) {
    throw createError({ statusCode: 400, message: "批量数量过多" });
  }

  const inserted = await recordFiles(payloads);
  return { code: 200, msg: "ok", data: { inserted } };
});
