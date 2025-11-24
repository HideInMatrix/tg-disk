<script lang="ts" setup>
import { ref } from "vue";
import { Upload } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import { Motion } from "motion-v";
import { useFileUpload } from "~/components/upload/useFileUpload";
import FileItem from "./FileItem.vue";
import UploadToolbar from "./UploadToolbar.vue";
import AreaText from "~/components/input/AreaText.vue";

interface FileUploadProps {
  class?: string;
  uploadUrl?: string;
  extraFormData?: Record<string, string>;
  multiple?: boolean;
}

const props = defineProps<FileUploadProps>();
const emit = defineEmits<{
  (e: "onChange", files: File[]): void;
  (e: "uploaded", responses: any[]): void;
}>();

// 使用 Composable
const {
  files,
  stats,
  addFiles,
  retryFailed,
  clearAll,
  clearSuccess,
  uploadDisk,
  uploadType
} = useFileUpload({
  uploadUrl: props.uploadUrl,
  extraFormData: props.extraFormData,
  onUploaded: (res) => emit('uploaded', res)
});

// 拖拽和输入框交互逻辑
const fileInputRef = ref<HTMLInputElement | null>(null);
const isActive = ref(false);

function handleFileChange(rawFiles: File[]) {
  emit('onChange', rawFiles)
  addFiles(rawFiles)
}

function handleUrlChange(urls: string[]) {
  addFiles(urls);
}

function onInputChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files) handleFileChange(Array.from(input.files));
}

function handleDrop(e: DragEvent) {
  isActive.value = false;
  if (e.dataTransfer?.files) handleFileChange(Array.from(e.dataTransfer.files));
}
</script>

<template>
  <ClientOnly>
    <div :class="cn('w-full relative', props.class)" @dragover.prevent="isActive = true" @dragleave="isActive = false"
      @drop.prevent="handleDrop">
      <!-- 工具栏 (当有文件时显示) -->
      <Motion :initial="{ opacity: 0, y: 10 }" :animate="{ opacity: 1, y: 0 }" class="relative z-50">
        <UploadToolbar v-model:upload-disk="uploadDisk" v-model:upload-type="uploadType" :stats="stats" :files="files"
          @retry="retryFailed" @clear-all="clearAll" @clear-success="clearSuccess" />
      </Motion>

      <div
        class="group/file relative block w-full cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-neutral-200 dark:border-neutral-800 p-10 transition-colors duration-300"
        v-if="uploadType === 'url'">
        <AreaText @upload-urls="handleUrlChange" />
        <!-- 文件列表 -->
        <div v-if="files.length !== 0" class="grid gap-3 mt-2">
          <FileItem v-for="file in files" :key="file.id" :item="file" />
        </div>
      </div>

      <!-- 拖拽/点击区域 -->
      <div
        class="group/file relative block w-full cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-neutral-200 dark:border-neutral-800 p-10 transition-colors duration-300"
        :class="{ 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20': isActive }" @click="fileInputRef?.click()" v-else>
        <input ref="fileInputRef" type="file" class="hidden" @change="onInputChange" :multiple="multiple" />

        <!-- 背景网格装饰 -->
        <div
          class="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]">
        </div>

        <!-- 列表内容区 -->
        <div class="relative z-20 flex flex-col gap-4">

          <!-- 空状态提示 -->
          <div v-if="files.length === 0" class="flex flex-col items-center justify-center py-10">
            <div class="mb-4 rounded-full bg-neutral-100 p-4 dark:bg-neutral-800">
              <Upload class="h-6 w-6 text-neutral-500" />
            </div>
            <p class="text-base font-bold text-neutral-700 dark:text-neutral-300">上传文件</p>
            <p class="mt-1 text-sm text-neutral-400">拖放文件到此处或点击上传</p>
          </div>

          <!-- 文件列表 -->
          <div v-else class="grid gap-3">
            <FileItem v-for="file in files" :key="file.id" :item="file" />
          </div>

          <!-- 继续添加文件的提示 (仅当有文件时显示在底部) -->
          <div v-if="files.length > 0" class="mt-4 text-center">
            <p class="text-xs text-neutral-400 hover:text-blue-500 transition">点击或拖拽更多文件以追加</p>
          </div>
        </div>
      </div>
    </div>
  </ClientOnly>
</template>