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
    "@vueuse/nuxt",
    "nuxt-auth-utils",
  ],

  runtimeConfig: {
    public: {
      auth: {
        loadStrategy: "client-only",
      },
      tgToken: process.env.NUXT_PUBLIC_TG_TOKEN,
      tgChatId: process.env.NUXT_PUBLIC_TG_CHAT_ID,
      allowHosts: process.env.NUXT_PUBLIC_ALLOW_HOSTS,
      account: process.env.NUXT_PUBLIC_ACCOUNT,
      password: process.env.NUXT_PUBLIC_PASSWORD,
      allowReferers: process.env.NUXT_PUBLIC_ALLOW_REFERERS,
    },
  },
  shadcn: {
    prefix: "",
    componentDir: "./app/components/ui",
  },
});
