// GET /api/files — 分页列出索引文件（受管 provider ∩ 请求过滤）
export default defineEventHandler(async (event) => {
  await assertFileIndex(event);
  const query = getQuery(event);
  const result = await listFiles({
    page: Number(query.page) || 1,
    pageSize: Number(query.pageSize) || 20,
    provider: query.provider ? String(query.provider) : undefined,
    q: query.q ? String(query.q) : undefined,
  });
  return { code: 200, msg: "ok", data: result };
});
