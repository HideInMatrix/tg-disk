<script setup lang="ts">
import { ref, computed } from "vue";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "vue-sonner";
import { LockKeyhole, LockKeyholeOpen } from "lucide-vue-next";

type CopyType = "markdown" | "url";

const { loggedIn } = useUserSession();

const props = defineProps<{
  uploadDisk: string;
  uploadType: string;
  stats: { pending: number; success: number; error: number };
  files: UploadableFile[];
  concurrency?: number;
}>();

const emit = defineEmits(["retry", "clearAll", "clearSuccess", "update:uploadDisk", "update:uploadType", "update:concurrency"]);

const dropdownOpen = ref(false);
const copyType = ref<CopyType>("markdown");
const concurrencyLocal = ref(props.concurrency ?? 3);

function updateConcurrency(v: number) {
  concurrencyLocal.value = v;
  emit("update:concurrency", v);
}

function copySuccessData() {
  let data = "";

  if (copyType.value === "markdown") {
    data = props.files
      .filter((f) => f.status === "done")
      .map((f, index) => `![${index}](${location.href}${f.url})`)
      .join("\n");
  }

  if (copyType.value === "url") {
    data = props.files
      .filter((f) => f.status === "done")
      .map((f) => f.response.url)
      .join("\n");
  }

  navigator.clipboard.writeText(data).then(() => {
    toast.success("复制成功");
  });
}

const innerUploadDisk = computed({
  get: () => props.uploadDisk,
  set: (val) => {
    emit("update:uploadDisk", val);
  },
});

const innerUploadType = computed({
  get: () => props.uploadType,
  set: (val) => emit("update:uploadType", val),
});
</script>

<template>
  <div class="flex w-full flex-col gap-6">
    <div class="flex justify-between">
      <Tabs v-model="innerUploadDisk">
        <TabsList>
          <TabsTrigger value="telegram">
            <div class="flex items-center gap-1">中心化 <LockKeyholeOpen :size="16" v-if="loggedIn" /> <LockKeyhole :size="16" v-else /></div>
          </TabsTrigger>
          <TabsTrigger value="ipfs" disable> 去中心化 </TabsTrigger>
        </TabsList>
      </Tabs>
      <Tabs v-model="innerUploadType">
        <TabsList>
          <TabsTrigger value="file"> 文件上传 </TabsTrigger>
          <TabsTrigger value="url" v-show="innerUploadDisk !== 'ipfs'"> 文件地址转存 </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
    <div class="w-full relative mx-auto mb-6 flex items-center justify-between rounded-lg bg-white/80 p-4 shadow-lg backdrop-blur-sm dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800">
      <!-- 统计 -->
      <div class="flex gap-4 text-sm">
        <div class="flex items-center gap-1">
          <span class="h-2 w-2 rounded-full bg-neutral-400"></span>
          <span class="text-neutral-600 dark:text-neutral-400">待上传 {{ stats.pending }}</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="h-2 w-2 rounded-full bg-green-500"></span>
          <span class="text-neutral-600 dark:text-neutral-400">成功 {{ stats.success }}</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="h-2 w-2 rounded-full bg-red-500"></span>
          <span class="text-neutral-600 dark:text-neutral-400">失败 {{ stats.error }}</span>
        </div>
      </div>

      <!-- 按钮组 -->
      <div class="flex items-center gap-2">
        <button @click="copySuccessData" class="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-100 transition font-medium">复制数据</button>

        <button v-if="stats.error > 0" @click="$emit('retry')" class="text-xs bg-orange-50 text-orange-600 px-3 py-1.5 rounded-md hover:bg-orange-100 transition font-medium">重试失败</button>

        <div class="relative">
          <button @click="dropdownOpen = !dropdownOpen" class="text-xs bg-neutral-100 text-neutral-600 px-3 py-1.5 rounded-md hover:bg-neutral-200 transition">清空 ▼</button>
          <div v-if="dropdownOpen" @click="dropdownOpen = false" class="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-xl border border-neutral-100 py-1 z-50 overflow-hidden">
            <button @click="$emit('clearAll')" class="w-full text-left px-4 py-2 text-xs hover:bg-neutral-50 text-red-600">清空全部</button>
            <button @click="$emit('clearSuccess')" class="w-full text-left px-4 py-2 text-xs hover:bg-neutral-50">只清空成功</button>
          </div>
        </div>
        <!-- 并发控制 -->
        <div class="flex items-center gap-2 ml-2">
          <label class="text-xs text-neutral-500">并发</label>
          <input type="number" min="1" class="w-16 text-sm rounded px-2 py-1 border" v-model.number="concurrencyLocal" @change="updateConcurrency(concurrencyLocal)" />
        </div>
      </div>
    </div>
  </div>
</template>
