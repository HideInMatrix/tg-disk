/**
 * IPFS PinMe 代理路由
 * 获取 PinMe IPFS 中存储的文件，通过本地服务代理转发
 * 使用方式: /api/ipfs/pinme/b06d1405 或 /api/ipfs/pinme/b06d1405/fileName
 * 真实地址: https://b06d1405.pinit.eth.limo/
 */

export default defineEventHandler(async (event) => {
    try {
        const path = getRouterParam(event, 'path') as string | string[] | undefined

        if (!path) {
            throw createError({
                statusCode: 400,
                statusMessage: 'PinMe shortUrl is required'
            })
        }

        // 转换路径参数为字符串（可能是数组）
        const shortUrl = Array.isArray(path) ? path.join('/') : path

        if (!shortUrl || shortUrl.trim().length === 0) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Invalid PinMe shortUrl'
            })
        }

        // 构建 PinMe 网关 URL
        // https://b06d1405.pinit.eth.limo/
        const gatewayUrl = `https://${shortUrl}.pinit.eth.limo/`

        try {
            // 通过 $fetch 获取文件数据
            const response = await $fetch.raw(gatewayUrl, {
                method: 'GET',
                timeout: 30000
            })

            if (!response) {
                throw createError({
                    statusCode: 404,
                    statusMessage: 'File not found on PinMe'
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
            console.error(`[PinMe Proxy] 获取文件失败: ${shortUrl}`, fetchError.message)

            throw createError({
                statusCode: 502,
                statusMessage: `Failed to fetch from PinMe: ${fetchError.message}`
            })
        }
    } catch (error: any) {
        console.error('[PinMe Proxy] 错误:', error)

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
