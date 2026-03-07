import { computed, toValue, type Component, type MaybeRefOrGetter } from "vue"
import { File, FileArchive, FileCode, FileMusic, FileSpreadsheet, FileText, FileVideoCamera } from "lucide-vue-next"
import { resolveFilePreviewMeta } from "@/lib/filePreview"

const fileTypeIconMap: Record<UploadableFilePreviewType, Component> = {
  image: File,
  video: FileVideoCamera,
  audio: FileMusic,
  text: FileText,
  spreadsheet: FileSpreadsheet,
  archive: FileArchive,
  code: FileCode,
  file: File,
}

export function useFilePreviewIcon(file: MaybeRefOrGetter<UploadableFile>) {
  const fileExtension = computed(() => {
    const currentFile = toValue(file)
    if (currentFile.fileExtension) return currentFile.fileExtension

    return resolveFilePreviewMeta({
      fileName: currentFile.file?.name,
      responseFileName: currentFile.response?.data?.file_name,
      url: currentFile.url,
    }).fileExtension
  })

  const mimeType = computed(() => {
    const currentFile = toValue(file)
    return (currentFile.file?.type || "").toLowerCase()
  })

  const fileType = computed<UploadableFilePreviewType>(() => {
    const currentFile = toValue(file)
    if (currentFile.fileType) return currentFile.fileType

    return resolveFilePreviewMeta({
      fileName: currentFile.file?.name,
      responseFileName: currentFile.response?.data?.file_name,
      url: currentFile.url,
    }).fileType
  })

  const isImage = computed(() => fileType.value === "image")

  const previewIcon = computed<Component>(() => {
    return fileTypeIconMap[fileType.value]
  })

  const extensionLabel = computed(() => {
    return fileExtension.value ? fileExtension.value.toUpperCase() : "FILE"
  })

  return {
    isImage,
    previewIcon,
    extensionLabel,
    fileExtension,
    fileType,
    mimeType,
  }
}
