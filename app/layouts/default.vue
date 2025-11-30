<script lang="ts" setup>
import "vue-sonner/style.css";
import { Toaster } from "@/components/ui/sonner";
</script>

<template>
  <div class="">
    <slot />
    <Toaster position="top-center" />
  </div>
</template>
