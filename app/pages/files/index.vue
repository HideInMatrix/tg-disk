<script lang="ts" setup>
import { ref, computed, onMounted, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Copy,
  Trash2,
  Pencil,
  ExternalLink,
  Check,
  X,
  Search,
} from "lucide-vue-next";
import { watchDebounced } from "@vueuse/core";
import { resolveFilePreviewMeta } from "@/lib/filePreview";
import { getFileTypeIcon } from "~/composables/useFilePreviewIcon";

definePageMeta({ middleware: "auth" });

const config = useRuntimeConfig();
const enabled = useFileIndexEnabled();
const { clear, loggedIn } = useUserSession();

const {
  items,
  total,
  page,
  provider,
  q,
  loading,
  managed,
  totalPages,
  fetchList,
  fetchSettings,
  saveSettings,
  remove,
  update,
  goPage,
  fileUrl,
  copyLink,
} = useFileIndex();

const providerLabels: Record<string, string> = {
  all: "全部",
  telegram: "Telegram",
  pinme: "PinMe",
  crossbell: "Crossbell",
};

const envProviders = computed(
  () =>
    String(config.public.fileIndexProviders || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as FileIndexProvider[]
);

onMounted(async () => {
  if (!enabled.value) return;
  await fetchSettings();
  await fetchList();
});

watch(provider, () => {
  page.value = 1;
  fetchList();
});

watchDebounced(
  q,
  () => {
    page.value = 1;
    fetchList();
  },
  { debounce: 400 }
);

function toggleManaged(p: FileIndexProvider) {
  const set = new Set(managed.value);
  if (set.has(p)) set.delete(p);
  else set.add(p);
  saveSettings(envProviders.value.filter((x) => set.has(x)));
}

function typeOf(rec: FileRecord): UploadableFilePreviewType {
  return (
    (rec.file_type as UploadableFilePreviewType) ||
    resolveFilePreviewMeta({ fileName: rec.file_name, url: rec.url }).fileType
  );
}
const isImage = (rec: FileRecord) => typeOf(rec) === "image";
const iconFor = (rec: FileRecord) => getFileTypeIcon(typeOf(rec));

function onDelete(rec: FileRecord) {
  const msg =
    rec.provider === "telegram"
      ? `确定删除「${rec.file_name}」？将同时尝试删除对应的 Telegram 消息。`
      : `确定删除「${rec.file_name}」？IPFS 内容不可控，仅移除索引记录（内容可能仍可通过网关访问）。`;
  if (window.confirm(msg)) remove(rec.id);
}

// 重命名
const editingId = ref<string | null>(null);
const editName = ref("");
function startEdit(rec: FileRecord) {
  editingId.value = rec.id;
  editName.value = rec.file_name;
}
function cancelEdit() {
  editingId.value = null;
  editName.value = "";
}
async function commitEdit(rec: FileRecord) {
  const name = editName.value.trim();
  if (name && name !== rec.file_name) await update(rec.id, { file_name: name });
  cancelEdit();
}

// 标签
const editingTagsId = ref<string | null>(null);
const editTags = ref("");
function startEditTags(rec: FileRecord) {
  editingTagsId.value = rec.id;
  editTags.value = (rec.tags || []).join(", ");
}
function cancelEditTags() {
  editingTagsId.value = null;
  editTags.value = "";
}
async function commitTags(rec: FileRecord) {
  const tags = editTags.value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  await update(rec.id, { tags });
  cancelEditTags();
}

function fmtSize(bytes: number | null) {
  if (bytes == null) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
function fmtDate(ms: number) {
  const d = new Date(ms);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const handleLogout = async () => {
  await clear();
  await navigateTo("/login");
};
</script>

<template>
  <NuxtLayout>
    <div class="max-w-6xl mx-auto p-6 min-h-screen flex flex-col">
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <NuxtLink to="/">
            <Button variant="outline" size="sm"><ArrowLeft class="h-4 w-4" /> 返回</Button>
          </NuxtLink>
          <h1 class="text-2xl font-medium">文件管理</h1>
        </div>
        <Button v-if="loggedIn" variant="outline" size="sm" @click="handleLogout">退出</Button>
      </div>

      <div v-if="!enabled" class="flex-1 flex items-center justify-center text-center text-neutral-500">
        文件索引功能未启用（需配置 Cloudflare D1 + KV 四项环境变量）
      </div>

      <template v-else>
        <!-- 工具栏 -->
        <div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs v-model="provider">
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger v-for="p in envProviders" :key="p" :value="p">
                {{ providerLabels[p] || p }}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div class="relative w-full sm:w-64">
            <Search class="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input v-model="q" placeholder="搜索文件名" class="pl-8" />
          </div>
        </div>

        <!-- provider 开关 -->
        <div class="mb-4 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span>管理范围：</span>
          <button
            v-for="p in envProviders"
            :key="p"
            @click="toggleManaged(p)"
            class="rounded-md border px-2 py-1 transition"
            :class="
              managed.includes(p)
                ? 'border-green-200 bg-green-50 text-green-600 dark:border-green-900 dark:bg-green-950'
                : 'border-neutral-200 bg-neutral-50 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900'
            "
          >
            {{ providerLabels[p] || p }} · {{ managed.includes(p) ? "开" : "关" }}
          </button>
        </div>

        <!-- 列表 -->
        <div class="flex-1">
          <div v-if="loading" class="py-10 text-center text-neutral-400">加载中...</div>
          <div v-else-if="!items.length" class="py-10 text-center text-neutral-400">暂无文件</div>
          <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card v-for="rec in items" :key="rec.id">
              <CardContent class="flex flex-col gap-2 p-3">
                <a
                  :href="fileUrl(rec)"
                  target="_blank"
                  rel="noopener"
                  class="flex h-32 items-center justify-center overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800"
                >
                  <img
                    v-if="isImage(rec)"
                    :src="fileUrl(rec)"
                    class="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <component :is="iconFor(rec)" v-else class="h-10 w-10 text-neutral-400" />
                </a>

                <!-- 文件名（可重命名） -->
                <div class="flex items-center gap-1">
                  <template v-if="editingId === rec.id">
                    <Input v-model="editName" class="h-7 text-sm" @keyup.enter="commitEdit(rec)" />
                    <button class="text-green-600" @click="commitEdit(rec)"><Check class="h-4 w-4" /></button>
                    <button class="text-neutral-400" @click="cancelEdit"><X class="h-4 w-4" /></button>
                  </template>
                  <template v-else>
                    <span class="flex-1 truncate text-sm font-medium" :title="rec.file_name">
                      {{ rec.file_name || "(未命名)" }}
                    </span>
                    <button class="text-neutral-400 hover:text-neutral-600" @click="startEdit(rec)">
                      <Pencil class="h-3.5 w-3.5" />
                    </button>
                  </template>
                </div>

                <div class="flex items-center justify-between text-xs text-neutral-400">
                  <span class="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
                    {{ providerLabels[rec.provider] || rec.provider }}
                  </span>
                  <span>{{ fmtSize(rec.file_size) }}</span>
                </div>
                <div class="text-xs text-neutral-400">{{ fmtDate(rec.created_at) }}</div>

                <!-- 标签 -->
                <div>
                  <template v-if="editingTagsId === rec.id">
                    <Input
                      v-model="editTags"
                      class="h-7 text-sm"
                      placeholder="标签，逗号分隔"
                      @keyup.enter="commitTags(rec)"
                    />
                    <div class="mt-1 flex gap-2">
                      <button class="text-xs text-green-600" @click="commitTags(rec)">保存</button>
                      <button class="text-xs text-neutral-400" @click="cancelEditTags">取消</button>
                    </div>
                  </template>
                  <div v-else class="flex flex-wrap items-center gap-1">
                    <span
                      v-for="t in rec.tags"
                      :key="t"
                      class="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600 dark:bg-blue-950"
                    >
                      {{ t }}
                    </span>
                    <button class="text-xs text-neutral-400 hover:text-neutral-600" @click="startEditTags(rec)">
                      +标签
                    </button>
                  </div>
                </div>

                <!-- 操作 -->
                <div class="flex items-center gap-3 border-t border-neutral-100 pt-1 dark:border-neutral-800">
                  <button
                    class="flex items-center gap-1 text-xs text-neutral-500 hover:text-blue-600"
                    @click="copyLink(rec)"
                  >
                    <Copy class="h-3.5 w-3.5" /> 复制
                  </button>
                  <a
                    :href="fileUrl(rec)"
                    target="_blank"
                    rel="noopener"
                    class="flex items-center gap-1 text-xs text-neutral-500 hover:text-blue-600"
                  >
                    <ExternalLink class="h-3.5 w-3.5" /> 打开
                  </a>
                  <button
                    class="ml-auto flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                    @click="onDelete(rec)"
                  >
                    <Trash2 class="h-3.5 w-3.5" /> 删除
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <!-- 分页 -->
        <div v-if="total > 0" class="mt-6 flex items-center justify-center gap-3 text-sm">
          <Button variant="outline" size="sm" :disabled="page <= 1" @click="goPage(page - 1)">上一页</Button>
          <span class="text-neutral-500">第 {{ page }} / {{ totalPages }} 页 · 共 {{ total }} 个</span>
          <Button variant="outline" size="sm" :disabled="page >= totalPages" @click="goPage(page + 1)">
            下一页
          </Button>
        </div>
      </template>
    </div>
  </NuxtLayout>
</template>
