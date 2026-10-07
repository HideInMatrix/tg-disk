// GET /api/files/settings — 读取 provider 允许列表与运行时受管开关
export default defineEventHandler(async (event) => {
  await assertFileIndex(event);
  return {
    code: 200,
    msg: "ok",
    data: {
      allowed: getIndexProviders(),
      managed: await getManagedProviders(),
    },
  };
});
