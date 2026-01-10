<script setup lang="ts">
import { Motion } from "motion-v"
import { Progress } from '~/components/ui/progress'
import type { UploadableFile } from '~/composables/useFileUpload'
import { cn } from "@/lib/utils"

defineProps<{
  item: UploadableFile
}>()

const statusColors = {
  pending: 'text-neutral-500',
  uploading: 'text-blue-500',
  done: 'text-green-600',
  error: 'text-red-600'
}
</script>

<template>
  <Motion 
    :initial="{ opacity: 0, scaleX: 0.9 }" 
    :animate="{ opacity: 1, scaleX: 1 }"
    class="flex items-start w-full rounded-md bg-white p-4 shadow-sm dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800"
  >
    <!-- 预览图 -->
    <div class="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-neutral-200 mr-4">
      <img :src="item.url" class="h-full w-full object-cover" alt="preview" />
    </div>

    <!-- 信息区 -->
    <div class="flex flex-1 flex-col justify-between h-full gap-2">
      <div class="flex justify-between items-start">
        <div class="flex flex-col">
          <span class="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[200px]">
            {{ item.file.name }}
          </span>
          <span class="text-xs text-neutral-400">
            {{ (item.file.size / (1024 * 1024)).toFixed(2) }} MB
          </span>
        </div>
        <span :class="cn('text-xs font-medium px-2 py-1 rounded-full bg-opacity-10', statusColors[item.status])">
          {{ item.status }}
        </span>
      </div>

      <!-- 进度条 -->
      <div class="w-full space-y-1">
        <Progress :model-value="item.progress" class="h-1.5" />
        <div class="flex justify-end text-[10px] text-neutral-400">
          {{ item.progress }}%
        </div>
      </div>
    </div>
  </Motion>
</template>