import {
  defineEventHandler,
  getHeader,
  getRequestURL,
  sendStream,
  setHeader,
} from "h3";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const getImageContentType = (imagePath: string) => {
  const header = readFileSync(imagePath, { encoding: "ascii", flag: "r" }).slice(
    0,
    32
  );

  if (header.includes("ftypavif")) return "image/avif";
  if (header.startsWith("RIFF") && header.includes("WEBP")) return "image/webp";
  return "image/webp";
};

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
  const refererFlag = config.public.refererFlag as boolean || false

  // 1. 没配置白名单就不做任何防盗链（方便本地调试）
  if (!allowHosts.length && !allowReferers.length) return;

  // 2. 只对 /file/... 和 /r2/... 做防盗链，其它接口、页面一律放行
  if (!path.startsWith("/file/") && !path.startsWith("/r2/")) return;

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
      refererAllowed = refererFlag;
    }
  }

  const allowed = hostAllowed && refererAllowed;

  if (!allowed) {
    const imagePath = join(process.cwd(), "public", "403.webp");

    if (!existsSync(imagePath)) {
      throw createError({
        statusCode: 404,
        statusMessage: "403 image not found",
      });
    }

    setHeader(event, "Content-Type", getImageContentType(imagePath));
    setHeader(event, "Cache-Control", "public, max-age=0");
    return sendStream(event, createReadStream(imagePath));
  }
});
