// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: [
    "@nuxt/image",
    "@nuxt/fonts",
    "@nuxt/scripts",
    "@unocss/nuxt",
    "shadcn-nuxt",
    '@vueuse/nuxt',
    "nuxt-auth-utils",
  ],
  
  runtimeConfig:{
    public:{
      tgToken: process.env.NUXT_PUBLIC_TG_BOT_TOKEN,
      tgChatId: process.env.NUXT_PUBLIC_TG_CHAT_ID,
      allowHosts: process.env.NUXT_PUBLIC_TG_ALLOW_WEBSITE,
      account: process.env.NUXT_PUBLIC_ACCOUNT,
      password: process.env.NUXT_PUBLIC_PASSWORD
    },
  },
  shadcn: {
    prefix: "",
    componentDir: "./app/components/ui",
  },
});