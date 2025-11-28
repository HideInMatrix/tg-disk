import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { defineEventHandler, sendStream, setHeader, getHeader } from 'h3';

export default defineEventHandler((event) => {
  const config = useRuntimeConfig();

  // 获取 Host（去除端口）
  const host = getHeader(event, 'host')?.split(':')[0] ?? "";

  // 获取白名单（过滤空值）
  const allowHosts = config.public.allowHosts
    ?.split(',')
    .map(h => h.trim())
    .filter(Boolean) ?? [];

  // 判断是否不在白名单
  const isBlocked =
    config.public.allowHosts &&           // 开启白名单检测
    event.path.startsWith("/file") &&     // 只处理 /file
    (!host || !allowHosts.includes(host)); // host 不合法


  if (isBlocked) {
    const filePath = join(process.cwd(), 'public/placeholder.svg');
    setHeader(event, "Content-Type", "image/svg+xml");
    setHeader(event, "Cache-Control", "public, max-age=3600");
    return sendStream(event, createReadStream(filePath));
  }
});
