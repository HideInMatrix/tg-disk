
interface UploaderOptions {
  uploadUrl?: string
  extraFormData?: Record<string, string>
}

export function uploadFileToTelegram(
  uFile: UploadableFile,
  options: UploaderOptions = {},
  onProgress?: (p: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const url = options.uploadUrl || '/api/telegram/send'
    xhr.open('POST', url)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && res.code === 200) {
          resolve(res)
        } else {
          reject(new Error(res.msg || `HTTP ${xhr.status}`))
        }
      } catch (err) {
        reject(err)
      }
    }

    xhr.onerror = () => reject(new Error('Network Error'))

    const fd = new FormData()
    fd.append('file', uFile.file)
    fd.append('fileName', uFile.file.name)
    if (options.extraFormData) {
      Object.entries(options.extraFormData).forEach(([k, v]) => fd.append(k, v))
    }

    xhr.send(fd)
  })
}

export function uploadUrlToTelegram(
  uFile: UploadableFile,
  options: UploaderOptions = {},
  onProgress?: (p: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const url = options.uploadUrl || '/api/telegram/url'
    xhr.open('POST', url)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && res.code === 200) {
          resolve(res)
        } else {
          reject(new Error(res.msg || `HTTP ${xhr.status}`))
        }
      } catch (err) {
        reject(err)
      }
    }

    xhr.onerror = () => reject(new Error('Network Error'))

    const fd = new FormData()
    fd.append('file', uFile.url)
    fd.append('fileName', uFile.url.split('/').pop() || 'file')
    if (options.extraFormData) {
      Object.entries(options.extraFormData).forEach(([k, v]) => fd.append(k, v))
    }

    xhr.send(fd)
  })
}

export default {
  uploadFileToTelegram,
  uploadUrlToTelegram,
}
