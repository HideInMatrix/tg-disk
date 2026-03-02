<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { Upload } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import { Motion } from "motion-v";
import { toast } from "vue-sonner";
import { useFileUpload } from "~/composables/useFileUpload";
import FileItem from "./FileItem.vue";
import UploadToolbar from "./UploadToolbar.vue";
import LoginOverlay from "./LoginOverlay.vue";
import AreaText from "~/components/input/AreaText.vue";

interface FileUploadProps {
  class?: string;
  uploadUrl?: string;
  extraFormData?: Record<string, string>;
  multiple?: boolean;
  concurrency?: number; // 最大并发数
}

const { loggedIn } = useUserSession();

const props = defineProps<FileUploadProps>();
const emit = defineEmits<{
  (e: "onChange", files: File[]): void;
  (e: "uploaded", responses: any[]): void;
}>();

// 使用 Composable
const { files, stats, addFiles, retryFailed, clearAll, clearSuccess, uploadDisk, uploadType, uploadLimits, currentUploadLimit, concurrency, setConcurrency } = useFileUpload({
  uploadUrl: props.uploadUrl,
  extraFormData: props.extraFormData,
  concurrency: props.concurrency ?? 3,
  onUploaded: (res) => emit("uploaded", res),
});

// 如果外部 props.concurrency 动态改变，同步设置
watch(
  () => props.concurrency,
  (val) => {
    if (val && typeof setConcurrency === "function") setConcurrency(val);
  },
);

// 拖拽和输入框交互逻辑
const fileInputRef = ref<HTMLInputElement | null>(null);
const isActive = ref(false);
const urlAreaRef = useTemplateRef("urlArea");
const currentDiskLabel = computed(() => (uploadDisk.value === "telegram" ? "Telegram" : "PinMe IPFS"));
const uploadLimitHint = computed(() => {
  return `${currentDiskLabel.value} 单文件上限 ${currentUploadLimit.value.maxMiBLabel} (${currentUploadLimit.value.maxBytesLabel})`;
});
const allUploadLimitHint = computed(() => {
  return `Telegram <= ${uploadLimits.value.telegram.maxMiBLabel}，PinMe IPFS <= ${uploadLimits.value.ipfs.maxMiBLabel}`;
});

function handleFileChange(rawFiles: File[]) {
  const { acceptedFiles, rejectedFiles } = addFiles(rawFiles);
  if (acceptedFiles.length > 0) {
    emit("onChange", acceptedFiles);
  }

  if (rejectedFiles.length > 0) {
    const firstRejected = rejectedFiles[0];
    if (!firstRejected) return;
    const suffix = rejectedFiles.length > 1 ? `，另有 ${rejectedFiles.length - 1} 个文件超限` : "";
    toast.error(
      `文件 ${firstRejected.file.name} 大小 ${firstRejected.actualSizeText}，超过 ${currentDiskLabel.value} 限制 ${firstRejected.limitSizeText}${suffix}`
    );
  }
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
    <div :class="cn('w-full relative', props.class)" @dragover.prevent="isActive = true" @dragleave="isActive = false" @drop.prevent="handleDrop">
      <!-- 工具栏 (当有文件时显示) -->
      <Motion :initial="{ opacity: 0, y: 10 }" :animate="{ opacity: 1, y: 0 }" class="relative z-50">
        <UploadToolbar
          v-model:upload-disk="uploadDisk"
          v-model:upload-type="uploadType"
          :stats="stats"
          :files="files"
          :concurrency="concurrency"
          @update:concurrency="setConcurrency"
          @retry="retryFailed"
          @clear-all="() => {clearAll(); urlAreaRef?.clear();}"
          @clear-success="clearSuccess" />
      </Motion>

      <!-- URL 转存区域 -->
      <div v-if="uploadType === 'url'" class="group/file relative block w-full cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-neutral-200 dark:border-neutral-800 p-10 transition-colors duration-300">
        <AreaText ref="urlArea" @upload-urls="handleUrlChange" />
        <div class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          URL 转存无法在浏览器预先读取远程文件大小，若超过目标平台限制会在服务端返回失败。
        </div>
        <!-- 文件列表 -->
        <div v-if="files.length !== 0" class="grid gap-3 mt-2">
          <FileItem v-for="file in files" :key="file.id" :item="file" />
        </div>
      </div>

      <!-- 文件上传区域 -->
      <div
        v-else
        class="group/file relative block w-full overflow-hidden rounded-lg border-2 border-dashed border-neutral-200 dark:border-neutral-800 p-10 transition-colors duration-300"
        :class="{
          'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20': isActive,
        }"
        @click="fileInputRef?.click()">
        <!-- 未登录蒙层 -->

        <input ref="fileInputRef" type="file" class="hidden" @change="onInputChange" :multiple="props.multiple" />

        <!-- 背景网格装饰 -->
        <div class="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]"></div>

        <!-- 列表内容区 -->
        <div class="relative z-20 flex flex-col gap-4">
          <div class="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-300">
            <p>{{ uploadLimitHint }}</p>
            <p class="mt-1 text-neutral-500 dark:text-neutral-400">{{ allUploadLimitHint }}</p>
          </div>

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

      <LoginOverlay v-if="!loggedIn && uploadDisk === 'telegram'" />
    </div>
  </ClientOnly>
</template>
