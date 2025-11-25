import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { defineEventHandler, sendStream } from 'h3';


export default defineEventHandler((event) => {
    const config = useRuntimeConfig()
    const headers = event.node.req.headers;
    
    const host = headers['host'];
    const allowHosts = [...config.public.allowHosts.split(",")]
    console.log("白名单域名",allowHosts)
    console.log("访问检测",(allowHosts.length > 0) && event.path.startsWith('/file') && (!!!host || !allowHosts.includes(host!)))
    // 只有设置了白名单才允许进行检测
    if ((allowHosts.length > 0) && event.path.startsWith('/file') && (!!!host || !allowHosts.includes(host!))) {
        const filePath = join(process.cwd(), 'public/placeholder.svg');
        setHeader(event, "Content-Type", "image/svg+xml");
        setHeader(event, "Cache-Control", "public, max-age=86400000"); // Cache for 1 day
        return sendStream(event, createReadStream(filePath));
    }
});