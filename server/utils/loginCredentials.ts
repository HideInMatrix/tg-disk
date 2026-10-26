import type { H3Event } from "h3";

/** Pages 的旧变量也可能只在运行时提供，不能只依赖构建时 process.env。 */
export function getLoginCredentials(event: H3Event) {
  const config = useRuntimeConfig(event);
  const env = event.context.cloudflare?.env;
  return {
    account: String(config.account || env?.NUXT_PUBLIC_ACCOUNT || process.env.NUXT_PUBLIC_ACCOUNT || ""),
    password: String(config.password || env?.NUXT_PUBLIC_PASSWORD || process.env.NUXT_PUBLIC_PASSWORD || ""),
  };
}
