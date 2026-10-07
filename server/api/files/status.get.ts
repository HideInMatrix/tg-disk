// GET /api/files/status — 公开只读：返回文件索引是否启用 + provider 允许列表
// 不做 assertFileIndex（未启用也要能回 enabled:false）；只暴露布尔值与 provider 名，不含任何 secret。
export default defineEventHandler(() => {
  return {
    code: 200,
    msg: "ok",
    data: {
      enabled: isFileIndexEnabled(),
      providers: isFileIndexEnabled() ? getIndexProviders() : [],
      r2Enabled: isR2Enabled(),
    },
  };
});
