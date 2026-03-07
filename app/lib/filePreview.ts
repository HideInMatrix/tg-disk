const imageExtensions = new Set([
  "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "avif", "ico", "heic", "heif", "tif", "tiff",
])

const videoExtensions = new Set([
  "mp4", "mov", "avi", "mkv", "webm", "m4v",
])

const audioExtensions = new Set([
  "mp3", "wav", "flac", "aac", "ogg", "m4a",
])

const textExtensions = new Set([
  "pdf", "txt", "md", "doc", "docx", "rtf", "odt",
])

const spreadsheetExtensions = new Set([
  "xls", "xlsx", "csv", "ods",
])

const archiveExtensions = new Set([
  "zip", "rar", "7z", "tar", "gz", "bz2", "xz",
])

const codeExtensions = new Set([
  "js", "jsx", "ts", "tsx", "vue", "json", "html", "css", "scss", "less", "sass", "xml", "yaml", "yml",
])

export function getFileName(input?: string): string {
  const [withoutQuery = ""] = (input || "").split("?")
  const [clean = ""] = withoutQuery.split("#")
  return clean.split("/").pop() || ""
}

export function getFileExtension(input?: string): string {
  const name = getFileName(input)
  const index = name.lastIndexOf(".")
  if (index <= 0 || index === name.length - 1) return ""
  return name.slice(index + 1).toLowerCase()
}

export function resolveFilePreviewType(extension?: string): UploadableFilePreviewType {
  if (!extension) return "file"
  if (imageExtensions.has(extension)) return "image"
  if (videoExtensions.has(extension)) return "video"
  if (audioExtensions.has(extension)) return "audio"
  if (textExtensions.has(extension)) return "text"
  if (spreadsheetExtensions.has(extension)) return "spreadsheet"
  if (archiveExtensions.has(extension)) return "archive"
  if (codeExtensions.has(extension)) return "code"
  return "file"
}

export function resolveFilePreviewMeta(input: {
  fileName?: string
  responseFileName?: string
  url?: string
}): Pick<UploadableFile, "fileExtension" | "fileType"> {
  const fileExtension =
    getFileExtension(input.fileName) ||
    getFileExtension(input.responseFileName) ||
    getFileExtension(input.url)

  return {
    fileExtension,
    fileType: resolveFilePreviewType(fileExtension),
  }
}
