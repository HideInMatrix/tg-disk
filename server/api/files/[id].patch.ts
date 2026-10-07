// PATCH /api/files/:id — 重命名 / 标签
export default defineEventHandler(async (event) => {
  await assertFileIndex(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "缺少 id" });

  const body = await readBody(event);
  const patch: UpdateFilePayload = {
    file_name: typeof body?.file_name === "string" ? body.file_name : undefined,
    tags: Array.isArray(body?.tags) ? body.tags.map((t: any) => String(t)) : undefined,
  };

  const record = await updateFile(id, patch);
  if (!record) throw createError({ statusCode: 404, message: "记录不存在" });
  return { code: 200, msg: "ok", data: record };
});
