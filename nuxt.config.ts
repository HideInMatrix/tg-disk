// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  app: {
    head: {
      script: [
        {
          src: 'https://docs.opencv.org/4.5.0/opencv.js',
          async: true,
          type: 'text/javascript'
        }
      ]
    }
  },
  modules: [
    "@nuxt/image",
    "@nuxt/scripts",
    "@unocss/nuxt",
    "shadcn-nuxt",
    "@vueuse/nuxt",
    "nuxt-auth-utils",
  ],

  runtimeConfig: {
    tgToken: process.env.NUXT_TG_TOKEN || process.env.NUXT_PUBLIC_TG_TOKEN,
    // 可选：Cloudflare D1 + KV 文件索引（运行时可被 NUXT_CF_* 覆盖；不暴露给客户端）
    cf: {
      accountId: process.env.NUXT_CF_ACCOUNT_ID,
      apiToken: process.env.NUXT_CF_API_TOKEN,
      d1DatabaseId: process.env.NUXT_CF_D1_DATABASE_ID,
      kvNamespaceId: process.env.NUXT_CF_KV_NAMESPACE_ID,
    },
    // 可选：Cloudflare R2 对象存储上传（S3 兼容 API；accountId 复用 cf.accountId）
    r2: {
      accessKeyId: process.env.NUXT_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.NUXT_R2_SECRET_ACCESS_KEY,
      bucket: process.env.NUXT_R2_BUCKET,
      endpoint: process.env.NUXT_R2_ENDPOINT, // 可选覆盖，默认 https://<accountId>.r2.cloudflarestorage.com
    },
    public: {
      auth: {
        loadStrategy: "client-only",
      },
      tgChatId: process.env.NUXT_PUBLIC_TG_CHAT_ID,
      allowHosts: process.env.NUXT_PUBLIC_ALLOW_HOSTS,
      account: process.env.NUXT_PUBLIC_ACCOUNT,
      password: process.env.NUXT_PUBLIC_PASSWORD,
      allowReferers: process.env.NUXT_PUBLIC_ALLOW_REFERERS,
      refererFlag: process.env.NUXT_PUBLIC_REFERER_FLAG === "true" ? true : false,
      // 可选：纳入管理的上传方式（逗号分隔），默认全开。启用状态由 /api/files/status 提供。
      fileIndexProviders:
        process.env.NUXT_PUBLIC_FILE_INDEX_PROVIDERS || "telegram,pinme,crossbell,r2",
    },
  },
  shadcn: {
    prefix: "",
    componentDir: "./app/components/ui",
  },
});
