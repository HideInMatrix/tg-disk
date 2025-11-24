<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from 'vue-sonner'

const formData = ref({
  account: "",
  password: ""
})

const handleLogin = async () => {
  const resp = await $fetch("/api/auth", { method: "POST", body: { ...formData.value } })
  if (resp.code === 200) {
    await navigateTo('/', {
      external: true,
    })
  } else {
    toast('登录失败，请检查账号密码', {
      description: '账号或密码错误，请重试',
    })
  }
}
</script>

<template>
  <div class="w-full h-full lg:grid lg:grid-cols-2">
    <div class="flex items-center justify-center py-12 h-full">
      <div class="mx-auto grid w-[350px] gap-6">
        <div class="grid gap-2 text-center">
          <h1 class="text-3xl font-bold">
            登录
          </h1>
          <p class="text-balance text-muted-foreground">
            输入你的邮箱账号
          </p>
        </div>
        <form @submit.prevent="handleLogin" method="post" class="grid gap-4">
          <div class="grid gap-2">
            <Label for="email">邮箱</Label>
            <Input v-model="formData.account" id="email" type="email" placeholder="m@example.com" required />
          </div>
          <div class="grid gap-2">
            <div class="flex items-center">
              <Label for="password">密码</Label>
            </div>
            <Input v-model="formData.password" id="password" type="password" required />
          </div>
          <Button type="submit" class="w-full cursor-pointer">登录</Button>
        </form>
      </div>
    </div>
    <div class="hidden bg-muted lg:block"></div>
  </div>
</template>
