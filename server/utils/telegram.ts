
interface TelegramOptions {
  token: string
  method: string
  formData: FormData
  headers?: Record<string, string>
  timeout?: number
}

/**
 * 带自动重试的 Telegram Bot API 请求
 * @param options
 * @param retries 默认重试次数（包括第一次请求在内算 1 次）
 * @param minDelayMs 最小延迟（ms）
 * @param maxDelayMs 最大延迟（ms）
 */
export async function fetchTelegramWithRetry(
  options: TelegramOptions,
  retries = 5,               // 总共尝试 3 次（1 次原始 + 2 次重试）
  minDelayMs = 10000,        // 10s
  maxDelayMs = 15000         // 15s
): Promise<any> {
  let lastError: any

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await $fetch(
        `https://api.telegram.org/bot${options.token}/${options.method}`,
        {
          method: 'POST',
          body: options.formData,
          headers: options.headers ?? {},
          timeout: options.timeout ?? 20_000,
        }
      )

      // Telegram 返回 { ok: false, error_code: xxx, description: '...' } 时也需要抛错
      if (response && typeof response === 'object' && !(response as any).ok) {
        throw new Error(`Telegram error ${(response as any).error_code}: ${(response as any).description}`)
      }

      return response
    } catch (err: any) {
      lastError = err

      // 已经是最后一次尝试，直接抛出
      if (attempt === retries) break

      // 随机延迟 10~15 秒
      const delay = minDelayMs + Math.random() * (maxDelayMs - minDelayMs)
      console.warn(`[Telegram] 第 ${attempt} 次请求失败，${delay / 1000}s 后重试...`, err.message || err)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // 所有尝试都失败
  throw lastError
}


/**
 * 获取文件信息
 * @param {Object} responseData - Telegram API响应数据
 * @returns {Object|null} 文件信息对象或null
 */
export function getFileInfo(responseData: { ok: any; description: any; result: { photo: any[]; video: any; audio: any; document: any } }) {
  const getFileDetails = (file: { file_id: any; file_name: any; file_unique_id: any; file_size: any }) => ({
    file_id: file.file_id,
    file_name: file.file_name || file.file_unique_id,
    file_size: file.file_size,
  });

  try {
    if (!responseData.ok) {
      console.error('Telegram API error:', responseData.description);
      return null;
    }

    if (responseData.result.photo) {
      const largestPhoto = responseData.result.photo.reduce((prev, current) =>
        (prev.file_size > current.file_size) ? prev : current
      );
      return getFileDetails(largestPhoto);
    }

    if (responseData.result.video) {
      return getFileDetails(responseData.result.video);
    }

    if (responseData.result.audio) {
      return getFileDetails(responseData.result.audio);
    }

    if (responseData.result.document) {
      return getFileDetails(responseData.result.document);
    }

    return null;
  } catch (error: any) {
    console.error('Error parsing Telegram response:', error.message);
    return null;
  }
}