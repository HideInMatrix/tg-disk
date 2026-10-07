// PUT /api/files/settings — 保存运行时受管 provider 开关（写入 KV）
export default defineEventHandler(async (event) => {
  await assertFileIndex(event);
  const body = await readBody(event);
  const providers: FileIndexProvider[] = Array.isArray(body?.providers) ? body.providers : [];
  const managed = await saveManagedProviders(providers);
  return { code: 200, msg: "ok", data: { managed } };
});
