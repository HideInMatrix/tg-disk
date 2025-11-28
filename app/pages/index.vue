<script lang="ts" setup>
import FileUpload from "~/components/upload/FileUpload.vue";
import FileUploadGrid from "~/components/upload/FileUploadGrid.vue";

definePageMeta({ middleware: "auth" });
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
    <div class="max-w-6xl mx-auto p-6">
      <div class="flex justify-between">
        <h1 class="text-2xl font-medium mb-4">你的网盘</h1>
        <div class="flex" v-if="loggedIn">
          <Button @click="handleLogout">退出</Button>
        </div>
      </div>
      <FileUpload :extra-form-data="uploadExtraFormData" :multiple="true">
        <FileUploadGrid />
      </FileUpload>
    </div>
  </NuxtLayout>
</template>
