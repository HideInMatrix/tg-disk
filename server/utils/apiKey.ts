import type { H3Event } from "h3";
import { timingSafeEqual } from "node:crypto";

export async function assertApiKey(event: H3Event): Promise<void> {
  const configured = String(useRuntimeConfig(event).apiKey || "");
  if (configured.length < 32) {
    throw createError({ statusCode: 503, message: "服务端未配置有效的 NUXT_API_KEY（至少32字符）" });
  }
  const supplied = getHeader(event, "x-api-key") || "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(configured);
  if (a.length === b.length && timingSafeEqual(a, b)) return;
  const session = await getUserSession(event);
  if (session.user?.login === "admin" && session.secure?.apiKeyAuth === true) return;
  throw createError({ statusCode: 401, message: "API Key 无效或未登录" });
}
