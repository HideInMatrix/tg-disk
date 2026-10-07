import { ref, computed } from "vue";
import { toast } from "vue-sonner";

/** 文件索引运行时状态（读公共 status 接口；SSR 阶段即取到，客户端无闪烁） */
export function useFileIndexStatus() {
  // SSR 内部请求需要转发当前 event.context（包括 Cloudflare R2 绑定）；普通 $fetch 会丢失。
  const requestFetch = useRequestFetch();
  const { data } = useAsyncData(
    "file-index-status",
    () =>
      requestFetch<{
        data: { enabled: boolean; providers: FileIndexProvider[]; r2Enabled: boolean };
      }>("/api/files/status").then((r) => r.data),
    {
      default: () => ({
        enabled: false,
        providers: [] as FileIndexProvider[],
        r2Enabled: false,
      }),
    }
  );
  return data;
}

/** 文件索引是否启用 */
export function useFileIndexEnabled() {
  const status = useFileIndexStatus();
  return computed(() => Boolean(status.value?.enabled));
}

/** R2 上传是否启用 */
export function useR2Enabled() {
  const status = useFileIndexStatus();
  return computed(() => Boolean(status.value?.r2Enabled));
}

export function useFileIndex() {
  const items = ref<FileRecord[]>([]);
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(20);
  const provider = ref<string>("all");
  const q = ref("");
  const loading = ref(false);

  const allowed = ref<FileIndexProvider[]>([]);
  const managed = ref<FileIndexProvider[]>([]);

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

  function errMsg(err: any, fallback: string) {
    return err?.data?.message || err?.data?.statusMessage || fallback;
  }

  async function fetchList() {
    loading.value = true;
    try {
      const res = await $fetch<{ code: number; data: FileListResult }>("/api/files", {
        query: {
          page: page.value,
          pageSize: pageSize.value,
          provider: provider.value,
          q: q.value || undefined,
        },
      });
      items.value = res.data.items;
      total.value = res.data.total;
    } catch (err: any) {
      toast.error(errMsg(err, "加载失败"));
    } finally {
      loading.value = false;
    }
  }

  async function fetchSettings() {
    try {
      const res = await $fetch<{
        data: { allowed: FileIndexProvider[]; managed: FileIndexProvider[] };
      }>("/api/files/settings");
      allowed.value = res.data.allowed;
      managed.value = res.data.managed;
    } catch {
      // 忽略：设置加载失败不影响列表
    }
  }

  async function saveSettings(providers: FileIndexProvider[]) {
    try {
      const res = await $fetch<{ data: { managed: FileIndexProvider[] } }>("/api/files/settings", {
        method: "PUT",
        body: { providers },
      });
      managed.value = res.data.managed;
      toast.success("已保存");
      page.value = 1;
      await fetchList();
    } catch (err: any) {
      toast.error(errMsg(err, "保存失败"));
    }
  }

  async function remove(id: string) {
    try {
      const res = await $fetch<{ data: { deleted: boolean; note?: string } }>(`/api/files/${id}`, {
        method: "DELETE",
      });
      toast.success(res.data?.note || "已删除");
      await fetchList();
    } catch (err: any) {
      toast.error(errMsg(err, "删除失败"));
    }
  }

  async function update(id: string, patch: UpdateFilePayload) {
    try {
      await $fetch(`/api/files/${id}`, { method: "PATCH", body: patch });
      toast.success("已更新");
      await fetchList();
    } catch (err: any) {
      toast.error(errMsg(err, "更新失败"));
    }
  }

  function goPage(p: number) {
    const next = Math.min(Math.max(1, p), totalPages.value);
    if (next === page.value) return;
    page.value = next;
    fetchList();
  }

  function fileUrl(rec: FileRecord) {
    if (typeof window === "undefined") return `/${rec.url}`;
    return `${window.location.origin}/${rec.url}`;
  }

  function copyLink(rec: FileRecord) {
    navigator.clipboard.writeText(fileUrl(rec)).then(() => toast.success("复制成功"));
  }

  return {
    items,
    total,
    page,
    pageSize,
    provider,
    q,
    loading,
    allowed,
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
  };
}
