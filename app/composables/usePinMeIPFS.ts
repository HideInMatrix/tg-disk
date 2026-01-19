import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import CryptoJS from 'crypto-js'

export type PinMeUploadResult = {
    status: 'success' | 'error'
    hash?: string
    name?: string
    shortUrl?: string
    size?: string
    message?: string
    traceId?: string
}

interface ChunkInitResponse {
    code: number
    msg: string
    data: {
        chunk_size: number
        session_id: string
        total_chunks: number
    }
}

interface ChunkUploadResponse {
    code: number
    msg: string
    data: {
        chunk_index: number
        chunk_size: number
    }
}

interface ChunkCompleteResponse {
    code: number
    msg: string
    data: {
        trace_id: string
    }
}

interface UploadStatusResponse {
    code: number
    msg: string
    data: {
        trace_id: string
        upload_rst: {
            Bytes: number
            Hash: string
            Name: string
            Size: string
            ShortUrl: string
        }
        is_ready: boolean
    }
}

const BASE_URL = 'https://pindata.dev/api/v3'

export function usePinMeIPFS() {
    const progress = ref<number>(0)
    const uploading = ref<boolean>(false)
    const currentFile = ref<File | null>(null)

    function reset() {
        progress.value = 0
        uploading.value = false
        currentFile.value = null
    }

    /**
     * 计算文件MD5哈希值
     * 借鉴服务器中ipfs.ts的MD5计算方式，使用CryptoJS在浏览器中兼容计算
     */
    function calculateMD5(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsArrayBuffer(file)
            reader.onload = () => {
                try {
                    const wordArray = CryptoJS.lib.WordArray.create(reader.result as ArrayBuffer)
                    const md5Hash = CryptoJS.MD5(wordArray).toString()
                    resolve(md5Hash)
                } catch (error) {
                    reject(error)
                }
            }
            reader.onerror = () => reject(reader.error)
        })
    }

    /**
     * 第一步：初始化上传会话
     */
    async function initChunk(file: File, uid?: string): Promise<ChunkInitResponse> {
        try {
            const md5 = await calculateMD5(file)
            const uploadUid = uid || uuidv4().replace(/-/g, '')

            const response = await fetch(`${BASE_URL}/chunk/init`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    file_name: file.name,
                    file_size: file.size,
                    md5: md5.toLowerCase(),
                    is_directory: false,
                    uid: uploadUid,
                }),
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            const data = (await response.json()) as ChunkInitResponse
            if (data.code !== 200) {
                throw new Error(data.msg || '初始化失败')
            }

            return data
        } catch (error) {
            throw new Error(`初始化上传失败: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 第二步：上传文件块
     */
    async function uploadChunk(
        file: File,
        sessionId: string,
        chunkIndex: number,
        uid: string
    ): Promise<ChunkUploadResponse> {
        try {
            const formData = new FormData()
            formData.append('session_id', sessionId)
            formData.append('chunk_index', String(chunkIndex))
            formData.append('uid', uid)
            formData.append('chunk', file)

            const response = await fetch(`${BASE_URL}/chunk/upload`, {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            const data = (await response.json()) as ChunkUploadResponse
            if (data.code !== 200) {
                throw new Error(data.msg || '上传失败')
            }

            return data
        } catch (error) {
            throw new Error(`上传文件块失败: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 第三步：完成上传
     */
    async function completeChunk(sessionId: string, uid: string): Promise<ChunkCompleteResponse> {
        try {
            const response = await fetch(`${BASE_URL}/chunk/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    uid,
                }),
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            const data = (await response.json()) as ChunkCompleteResponse
            if (data.code !== 200) {
                throw new Error(data.msg || '完成上传失败')
            }

            return data
        } catch (error) {
            throw new Error(`完成上传失败: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 第四步：查询上传状态
     */
    async function getUploadStatus(traceId: string, uid: string): Promise<UploadStatusResponse> {
        try {
            const params = new URLSearchParams({
                trace_id: traceId,
                uid,
            })

            const response = await fetch(`${BASE_URL}/up_status?${params}`, {
                method: 'GET',
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            const data = (await response.json()) as UploadStatusResponse
            if (data.code !== 200) {
                throw new Error(data.msg || '查询状态失败')
            }

            return data
        } catch (error) {
            throw new Error(`查询上传状态失败: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 轮询等待上传完成
     */
    async function waitForUploadReady(
        traceId: string,
        uid: string,
        maxRetries = 30,
        interval = 1000
    ): Promise<UploadStatusResponse> {
        let retries = 0

        while (retries < maxRetries) {
            try {
                const result = await getUploadStatus(traceId, uid)
                if (result.data.is_ready) {
                    return result
                }
            } catch (error) {
                // 继续轮询
            }

            retries++
            await new Promise((resolve) => setTimeout(resolve, interval))
        }

        throw new Error('上传超时，请稍后重试')
    }

    /**
     * 执行完整的上传流程
     */
    async function uploadFile(file: File): Promise<PinMeUploadResult> {
        if (!file) {
            return {
                status: 'error',
                message: '没有提供文件',
            }
        }

        try {
            uploading.value = true
            currentFile.value = file
            progress.value = 10

            // 先生成uid，保证整个流程中uid一致
            const uid = uuidv4().replace(/-/g, '')

            // 第一步：初始化，传入生成的uid
            const initResult = await initChunk(file, uid)
            const { session_id: sessionId, total_chunks: totalChunks } = initResult.data
            progress.value = 20

            // 第二步：上传文件块（这里假设只有一个chunk）
            await uploadChunk(file, sessionId, 0, uid)
            progress.value = 60

            // 第三步：完成上传
            const completeResult = await completeChunk(sessionId, uid)
            const { trace_id: traceId } = completeResult.data
            progress.value = 80

            // 第四步：轮询等待上传完成并获取结果
            const statusResult = await waitForUploadReady(traceId, uid)
            const uploadRst = statusResult.data.upload_rst

            progress.value = 100
            uploading.value = false

            return {
                status: 'success',
                hash: uploadRst.Hash,
                name: uploadRst.Name,
                shortUrl: uploadRst.ShortUrl,
                size: uploadRst.Size,
                traceId,
            }
        } catch (error) {
            uploading.value = false
            const message = error instanceof Error ? error.message : String(error)
            return {
                status: 'error',
                message,
            }
        }
    }

    return {
        progress: computed(() => progress.value),
        uploading: computed(() => uploading.value),
        currentFile: computed(() => currentFile.value),
        uploadFile,
        reset,
        // 暴露内部方法供高级使用
        initChunk,
        uploadChunk,
        completeChunk,
        getUploadStatus,
        waitForUploadReady,
    }
}

export default usePinMeIPFS
