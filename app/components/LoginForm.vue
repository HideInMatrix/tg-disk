<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-vue-next";
import { toast } from "vue-sonner";

const apiKey = ref("");
const showKey = ref(false);
const isSubmitting = ref(false);
const { fetch: fetchUserSession } = useUserSession();

async function handleLogin() {
  if (isSubmitting.value || !apiKey.value) return;
  isSubmitting.value = true;
  try {
    await $fetch("/api/auth", { method: "POST", body: { apiKey: apiKey.value } });
    apiKey.value = "";
    await fetchUserSession();
    await navigateTo("/");
  } catch {
    toast.error("验证失败，请检查 API Key 或服务端配置");
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="w-full h-full lg:grid lg:grid-cols-2">
    <div class="flex items-center justify-center py-12 h-full">
      <div class="mx-auto grid w-[350px] gap-6">
        <div class="grid gap-2 text-center">
          <h1 class="text-3xl font-bold">API Key 验证</h1>
          <p class="text-balance text-muted-foreground">请输入部署者在服务端 .env 中设置的 API Key</p>
        </div>
        <form @submit.prevent="handleLogin" class="grid gap-4">
          <div class="grid gap-2">
            <Label for="api-key">API Key</Label>
            <div class="relative">
              <Input v-model="apiKey" id="api-key" :type="showKey ? 'text' : 'password'" autocomplete="off" placeholder="输入 API Key" required class="pr-10" />
              <button type="button" @click="showKey = !showKey" class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500" :aria-label="showKey ? '隐藏 Key' : '显示 Key'">
                <Eye v-if="showKey" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </button>
            </div>
          </div>
          <Button type="submit" class="w-full cursor-pointer" :disabled="isSubmitting">
            {{ isSubmitting ? "验证中..." : "验证并进入" }}
          </Button>
        </form>
      </div>
    </div>
    <div class="hidden bg-muted lg:block"></div>
  </div>
</template>
