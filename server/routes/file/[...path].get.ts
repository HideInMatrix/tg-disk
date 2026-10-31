import { createTelegramFileProxy } from "~~/server/utils/telegramProxy";

const proxyFile = createTelegramFileProxy();

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const rawPath = getRouterParams(event).path;
  const fileId = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;
  // Return a Web Response directly: Nitro preserves streaming on Pages and Node.
  // The body wrapper owns its timeout until EOF/cancel, not until response headers arrive.
  return proxyFile(fileId || "", String(config.tgToken || ""), Boolean(event.context.cloudflare));
});
