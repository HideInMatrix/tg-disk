<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-vue-next";
import { toast } from "vue-sonner";

const account = ref("");
const password = ref("");
const showPassword = ref(false);
const isSubmitting = ref(false);
const { fetch: fetchUserSession } = useUserSession();

async function handleLogin() {
  if (isSubmitting.value || !account.value || !password.value) return;
  isSubmitting.value = true;
  try {
    await $fetch("/api/auth", { method: "POST", body: { account: account.value, password: password.value } });
    password.value = "";
    await fetchUserSession();
    await navigateTo("/");
  } catch {
    toast.error("登录失败，请检查账号密码或服务端配置");
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
          <h1 class="text-3xl font-bold">登录</h1>
          <p class="text-balance text-muted-foreground">请输入账号和密码</p>
        </div>
        <form @submit.prevent="handleLogin" class="grid gap-4">
          <div class="grid gap-2">
            <Label for="account">账号</Label>
            <Input v-model="account" id="account" type="text" autocomplete="username" placeholder="输入账号" required />
          </div>
          <div class="grid gap-2">
            <Label for="password">密码</Label>
            <div class="relative">
              <Input v-model="password" id="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="输入密码" required class="pr-10" />
              <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500" :aria-label="showPassword ? '隐藏密码' : '显示密码'">
                <Eye v-if="showPassword" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </button>
            </div>
          </div>
          <Button type="submit" class="w-full cursor-pointer" :disabled="isSubmitting">
            {{ isSubmitting ? "登录中..." : "登录" }}
          </Button>
        </form>
      </div>
    </div>
    <div class="hidden bg-muted lg:block"></div>
  </div>
</template>
