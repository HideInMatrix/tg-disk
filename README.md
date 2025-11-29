# TG 网盘

使用 Telegram 编写的个人网盘项目，主要存放一些小文件。

## 技术框架

- Nuxt4

## 上传组件（并发限制）

`components/upload/useFileUpload.ts` 新增了并发队列，允许限制同时上传的文件数。

- 默认并发数：3
- 可以在 `FileUpload.vue` 中通过 `concurrency` 属性设置初始值，或通过 `UploadToolbar` 中的并发控制直接调整。

示例：

```vue
<FileUpload :concurrency="4" />
```

这有助于避免同时触发多个上传接口导致后端保护/限流。

### 服务端（可选）

服务端也内置了一个并发控制工具 `server/utils/concurrency.ts`，可通过 `configureConcurrency("upload", { maxConcurrent: 2 })` 等方法根据业务场景调整限制。
