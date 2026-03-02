import { computed, toValue, type Component, type MaybeRefOrGetter } from "vue"
import { File, FileArchive, FileCode, FileMusic, FileSpreadsheet, FileText, FileVideoCamera } from "lucide-vue-next"

const imageExtensions = new Set([
  "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "avif", "ico", "heic", "heif", "tif", "tiff",
])

const fileTypeIconMap: Record<string, Component> = {
  pdf: FileText,
  txt: FileText,
  md: FileText,
  doc: FileText,
  docx: FileText,
  rtf: FileText,
  odt: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  ods: FileSpreadsheet,
  zip: FileArchive,
  rar: FileArchive,
  "7z": FileArchive,
  tar: FileArchive,
  gz: FileArchive,
  bz2: FileArchive,
  xz: FileArchive,
  js: FileCode,
  jsx: FileCode,
  ts: FileCode,
  tsx: FileCode,
  vue: FileCode,
  json: FileCode,
  html: FileCode,
  css: FileCode,
  scss: FileCode,
  less: FileCode,
  sass: FileCode,
  xml: FileCode,
  yaml: FileCode,
  yml: FileCode,
  mp3: FileMusic,
  wav: FileMusic,
  flac: FileMusic,
  aac: FileMusic,
  ogg: FileMusic,
  m4a: FileMusic,
  mp4: FileVideoCamera,
  mov: FileVideoCamera,
  avi: FileVideoCamera,
  mkv: FileVideoCamera,
  webm: FileVideoCamera,
  m4v: FileVideoCamera,
}

function getFileExtension(input?: string): string {
  const [withoutQuery = ""] = (input || "").split("?")
  const [clean = ""] = withoutQuery.split("#")
  const name = clean.split("/").pop() || ""
  const index = name.lastIndexOf(".")
  if (index <= 0 || index === name.length - 1) return ""
  return name.slice(index + 1).toLowerCase()
}

export function useFilePreviewIcon(file: MaybeRefOrGetter<UploadableFile>) {
  const fileExtension = computed(() => {
    const currentFile = toValue(file)
    return (
      getFileExtension(currentFile.file?.name) ||
      getFileExtension(currentFile.response?.data?.file_name) ||
      getFileExtension(currentFile.url)
    )
  })

  const mimeType = computed(() => {
    const currentFile = toValue(file)
    return (currentFile.file?.type || "").toLowerCase()
  })

  const isImage = computed(() => {
    return mimeType.value.startsWith("image/") || imageExtensions.has(fileExtension.value)
  })

  const previewIcon = computed<Component>(() => {
    if (fileExtension.value) {
      const mappedIcon = fileTypeIconMap[fileExtension.value]
      if (mappedIcon) return mappedIcon
    }
    if (mimeType.value.startsWith("video/")) return FileVideoCamera
    if (mimeType.value.startsWith("audio/")) return FileMusic
    if (mimeType.value.startsWith("text/")) return FileText
    if (mimeType.value.includes("spreadsheet") || mimeType.value.includes("excel") || mimeType.value.includes("csv")) return FileSpreadsheet
    if (mimeType.value.includes("zip") || mimeType.value.includes("archive") || mimeType.value.includes("compressed")) return FileArchive
    if (mimeType.value.includes("json") || mimeType.value.includes("javascript") || mimeType.value.includes("xml")) return FileCode
    return File
  })

  const extensionLabel = computed(() => {
    return fileExtension.value ? fileExtension.value.toUpperCase() : "FILE"
  })

  return {
    isImage,
    previewIcon,
    extensionLabel,
    fileExtension,
    mimeType,
  }
}
