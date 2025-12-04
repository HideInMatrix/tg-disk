import {
  defineEventHandler,
  setHeader,
  getHeader,
  getRequestURL,
} from "h3";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const url = getRequestURL(event);
  const path = url.pathname;

  const allowHosts =
    config.public.allowHosts
      ?.split(",")
      .map((h) => h.trim())
      .filter(Boolean) ?? [];

  const allowReferers =
    config.public.allowReferers
      ?.split(",")
      .map((h) => h.trim())
      .filter(Boolean) ?? [];

  // 1. 没配置白名单就不做任何防盗链（方便本地调试）
  if (!allowHosts.length && !allowReferers.length) return;

  // 2. 只对 /file/... 做防盗链，其它接口、页面一律放行
  if (!path.startsWith("/file/")) return;

  // 3. 检查 Host（访问你站点的域名）
  const host = getHeader(event, "host")?.split(":")[0] ?? "";
  const hostAllowed = !allowHosts.length || allowHosts.includes(host);

  // 4. 检查 Referer（资源被哪个页面引用）
  const referer = getHeader(event, "referer") || "";
  let refererAllowed = true;

  if (allowReferers.length) {
    // 从 referer 抽出域名
    try {
      const refererHost = new URL(referer).hostname;
      refererAllowed = allowReferers.includes(refererHost);
    } catch {
      // 没有 referer 或格式错误，当成不合法（你也可以改成放行）
      refererAllowed = false;
    }
  }

  const allowed = hostAllowed && refererAllowed;

  if (!allowed) {
    console.log("referer",referer);
    console.log("host",host);
    console.log("url",url);
    
    
    const response = await fetch("https://36f02096.pinit.eth.limo");
    if (!response.ok) {
      // 如果外部图片加载失败，你可以返回 404 或 500
      throw createError({ statusCode: 404, statusMessage: 'Placeholder image not found' });
    }
    // ❌ 不允许访问：返回占位图，或者你也可以直接 403
    setHeader(event, "Content-Type", "image/webp");
    setHeader(event, "Cache-Control", "public, max-age=0");
    return sendStream(event, response.body as ReadableStream);
  }
});
