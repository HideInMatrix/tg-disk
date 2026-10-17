import { timingSafeEqual } from "node:crypto";

export default defineEventHandler(async (event) => {
  const configured = String(useRuntimeConfig(event).apiKey || "");
  if (configured.length < 32) {
    throw createError({ statusCode: 503, message: "请先配置 NUXT_API_KEY（至少32字符）" });
  }
  const body = await readBody(event);
  const supplied = typeof body?.apiKey === "string" ? body.apiKey : "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(configured);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw createError({ statusCode: 401, message: "API Key 不正确" });
  }
  await setUserSession(event, {
    user: { login: "admin" },
    secure: { apiKeyAuth: true },
    loggedInAt: new Date(),
  }, { maxAge: 60 * 60 * 24 * 7 });
  return { code: 200, data: true };
});
