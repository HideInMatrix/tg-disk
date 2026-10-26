import { timingSafeEqual } from "node:crypto";

export default defineEventHandler(async (event) => {
  const credentials = getLoginCredentials(event);
  if (!credentials.account || !credentials.password) {
    throw createError({ statusCode: 503, message: "请先配置网页登录账号和密码（NUXT_ACCOUNT / NUXT_PASSWORD）" });
  }
  const body = await readBody<{ account?: unknown; password?: unknown }>(event);
  const account = typeof body?.account === "string" ? body.account : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const a = Buffer.from(password);
  const b = Buffer.from(credentials.password);
  if (account !== credentials.account || a.length !== b.length || !timingSafeEqual(a, b)) {
    throw createError({ statusCode: 401, message: "账号或密码不正确" });
  }
  await setUserSession(event, {
    user: { login: "admin" },
    secure: { accountAuth: true },
    loggedInAt: new Date(),
  }, { maxAge: 60 * 60 * 24 * 7 });
  return { code: 200, data: true };
});
