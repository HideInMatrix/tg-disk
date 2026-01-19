<template>
  <Transition name="fade">
    <div class="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center z-40 backdrop-blur-sm">
      <div class="bg-white dark:bg-neutral-900 rounded-lg p-6 shadow-lg text-center max-w-sm">
        <p class="text-lg font-bold text-neutral-900 dark:text-white mb-2">需要登录</p>
        <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-4">使用 Telegram 存储需要先登录账户</p>
        <NuxtLink to="/login" class="inline-block px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition"> 前往登录 </NuxtLink>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
