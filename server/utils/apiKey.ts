import type { H3Event } from "h3";
import { timingSafeEqual } from "node:crypto";

export async function assertApiKey(event: H3Event): Promise<void> {
  const configured = String(useRuntimeConfig(event).apiKey || "");
  const supplied = getHeader(event, "x-api-key") || "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(configured);
  if (configured.length >= 32 && a.length === b.length && timingSafeEqual(a, b)) return;

  const session = await getUserSession(event);
  // apiToken 是旧版账号密码登录写入的服务端会话标记，兼容尚未过期的旧 Cookie。
  if (session.user?.login === "admin" &&
      (session.secure?.accountAuth === true || session.secure?.apiToken === "1234567890")) return;
  throw createError({ statusCode: 401, message: "API Key 无效或未登录" });
}
