<script lang="ts" setup>
import { Github } from "lucide-vue-next";
import FileUpload from "~/components/upload/FileUpload.vue";
import FileUploadGrid from "~/components/upload/FileUploadGrid.vue";

const config = useRuntimeConfig();
const { clear, loggedIn } = useUserSession();

const uploadExtraFormData = {
  chatId: config.public.tgChatId,
};

const handleLogout = async () => {
  await clear();
  await navigateTo("/login");
};
</script>

<template>
  <NuxtLayout>
    <div class="max-w-6xl mx-auto p-6 min-h-screen flex flex-col">
      <div class="flex justify-between">
        <h1 class="text-2xl font-medium mb-4">MM盘</h1>
        <div class="flex" v-if="loggedIn">
          <Button @click="handleLogout">退出</Button>
        </div>
      </div>
      <div class="flex-1">
        <FileUpload :extra-form-data="uploadExtraFormData" :multiple="true">
          <FileUploadGrid />
        </FileUpload>
      </div>
      <footer class="mt-10">
        <div class="rounded-xl border border-neutral-200 bg-gradient-to-r from-neutral-50 to-white px-5 py-4 shadow-sm dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-950">
          <div class="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
            <div>
              <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100">喜欢这个项目？欢迎查看源码并支持一下</p>
              <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">开源仓库中包含完整实现与最新更新</p>
            </div>
            <a
              href="https://github.com/HideInMatrix/tg-disk"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 rounded-full border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <Github class="h-4 w-4" />
              <span>查看 GitHub 仓库</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  </NuxtLayout>
</template>
