// DELETE /api/files/:id — 删除记录（Telegram 尽力删消息，R2 删除对象）
export default defineEventHandler(async (event) => {
  await assertFileIndex(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "缺少 id" });

  const result = await deleteFile(id, event);
  if (!result.deleted) throw createError({ statusCode: 404, message: "记录不存在" });
  return { code: 200, msg: "ok", data: result };
});
