import { ref } from 'vue'

export type IPFSUploadResult = {
  status: string
  cid?: string
  url?: string
  web2url?: string
  fileSize?: number
  [key: string]: any
}

export function useIPFS() {
  const progress = ref<number>(0)
  const uploading = ref<boolean>(false)

  const MAX_SIZE = 30 * 1024 * 1024 // 30MB

  function reset() {
    progress.value = 0
    uploading.value = false
  }

  function uploadFile(file: File): Promise<IPFSUploadResult> {
    if (!file) return Promise.reject(new Error('没有提供文件'))
    if (file.size > MAX_SIZE) return Promise.reject(new Error('文件太大，请选择小于30MB的图片'))

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const form = new FormData()
      form.append('file', file)

      uploading.value = true
      progress.value = 0

      xhr.open('POST', 'https://ipfs-relay.crossbell.io/upload')

      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable) {
          progress.value = Math.round((e.loaded / e.total) * 100)
        }
      }

      xhr.onload = () => {
        try {
          const statusCode = xhr.status
          const text = xhr.responseText || '{}'
          const data = JSON.parse(text)

          if (statusCode >= 200 && statusCode < 300 && (data.status === 'ok' || data.status === 'success')) {
            progress.value = 100
            uploading.value = false
            resolve(data as IPFSUploadResult)
          } else {
            uploading.value = false
            const msg = data?.message || `上传失败，HTTP ${statusCode}`
            reject(new Error(msg))
          }
        } catch (err) {
          uploading.value = false
          reject(err)
        }
      }

      xhr.onerror = () => {
        uploading.value = false
        reject(new Error('网络错误，上传失败'))
      }

      try {
        xhr.send(form)
      } catch (err) {
        uploading.value = false
        reject(err)
      }
    })
  }

  return {
    progress,
    uploading,
    uploadFile,
    reset,
  }
}

export default useIPFS
