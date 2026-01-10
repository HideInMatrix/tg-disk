/**
 * IPFS Crossbell 代理路由
 * 获取 IPFS 中存储的文件，通过本地服务代理转发
 * 使用方式: /api/ipfs/crossbell/Qm... 或 /api/ipfs/crossbell/QmXxxx/fileName
 */

export default defineEventHandler(async (event) => {
  try {
    const path = getRouterParam(event, 'path') as string | string[] | undefined
    
    if (!path) {
      throw createError({
        statusCode: 400,
        statusMessage: 'IPFS path is required'
      })
    }

    // 转换路径参数为字符串（可能是数组）
    const ipfsPath = Array.isArray(path) ? path.join('/') : path
    
    if (!ipfsPath || ipfsPath.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid IPFS path'
      })
    }

    // 构建 IPFS 网关 URL
    const gatewayUrl = `https://ipfs.io/ipfs/${ipfsPath}`
    
    try {
      // 通过 $fetch 获取文件数据
      const response = await $fetch.raw(gatewayUrl, {
        method: 'GET',
        timeout: 30000
      })

      if (!response) {
        throw createError({
          statusCode: 404,
          statusMessage: 'File not found on IPFS'
        })
      }

      // 获取响应头
      const contentType = response.headers.get('content-type') || 'application/octet-stream'

      // 设置响应头
      setHeader(event, 'Content-Type', contentType)

      
      // 设置缓存头（可选，IPFS 内容通常不变）
      setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

      // 返回文件内容
      return response._data
    } catch (fetchError: any) {
      console.error(`[IPFS Proxy] 获取文件失败: ${ipfsPath}`, fetchError.message)
      
      throw createError({
        statusCode: 502,
        statusMessage: `Failed to fetch from IPFS: ${fetchError.message}`
      })
    }
  } catch (error: any) {
    console.error('[IPFS Proxy] 错误:', error)
    
    // 如果已是 H3 错误，直接抛出
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})
