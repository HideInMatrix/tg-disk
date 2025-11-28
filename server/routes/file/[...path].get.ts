import { createError } from 'h3'
import { defaultHeaders } from '#imports'
import axios from "axios"

function getMimeType(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4',
    pdf: 'application/pdf', mp3: 'audio/mpeg',
  }
  return map[ext || ''] || null
}

export default defineEventHandler(async (event) => {
  const envConfig = useRuntimeConfig()
  const fileId = getRouterParam(event, 'path')
  if (!fileId) {
    throw createError({ statusCode: 400, message: 'file_id 必传' })
  }

  const isFilePath = fileId.match(/\.(png|jpg|jpeg|gif|webp|mp4|pdf|mp3)$/i)
  let fileUrl: string | undefined
  let fileName: string = "file"

  if(isFilePath){
    fileUrl = `https://telegra.ph/file/${fileId}`
  }else{
    // 1) 从 Telegram 获取 file_path（文件在 Telegram 文件服务器上的路径）
    const infoResp = await axios.get(
      `https://api.telegram.org/bot${envConfig.public.tgToken}/getFile?file_id=${fileId}`,
      { method: 'GET', headers: defaultHeaders }
    )
  
    if (!infoResp || !infoResp.data) {
      // 使用 message 而不是 statusMessage，避免 h3 的警告
      throw createError({ statusCode: 400, message: '无法获取文件信息' })
    }
  
    const filePath = infoResp.data?.result.file_path
  
    if (!filePath) {
      // 使用 message 而不是 statusMessage，避免 h3 的警告
      throw createError({ statusCode: 404, message: 'file_path 未找到' })
    }
  
    fileUrl = `https://api.telegram.org/file/bot${envConfig.public.tgToken}/${filePath}`
  
    fileName = filePath.split('/').pop() || 'file'
  }
  
  try {
    const response = await axios.get(fileUrl, {
      headers:{ ...defaultHeaders, Referer: isFilePath?"https://telegra.ph/":"https://api.telegram.com/" },
      responseType: "stream", // Stream to reduce memory usage
    });
    
    // 设置响应头
    const contentType = getMimeType(fileName) || response.headers["content-type"]

    setHeader(event, "Content-Type", contentType);
    setHeader(event, "Cache-Control", "public, max-age=10"); // Cache for 1 day

    // 流式传输：直接将 Telegram 文件流发送给客户端
    return sendStream(event, response.data) // 关键: 流式传输

  } catch (err: any) {

    if (err.name === 'AbortError') {
      throw createError({ statusCode: 504, message: 'Telegram timeout' })
    }
    if (err.code === 'UND_ERR_CONNECT_TIMEOUT') {
      throw createError({ statusCode: 504, message: 'Connect to Telegram timeout' })
    }

    console.error('Telegram 代理接口错误:', err)
    throw createError({ statusCode: 502, message: 'Bad gateway' })
  }
})
