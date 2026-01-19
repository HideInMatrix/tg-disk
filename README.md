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

### 特色

1. 无限存储网盘
2. ipfs,telegram存储方式
3. 防盗措施

## telegram bot

### 获取 TG_BOT_TOKEN

在 Telegram 中搜索 @BotFather
发送 /newbot 命令
按提示输入 Bot 名称和用户名
获得 Bot Token（格式：123456789:ABCdefGHIjklMNOpqrsTUVwxyz）
创建 Telegram Bot

### 获取 TG_CHAT_ID

创建一个新的 Telegram 频道（Channel）
将创建的 Bot 添加为频道管理员
给予 Bot 消息管理的权限
Manage Channel -> administrators -> 开启除了Add New admins之外的所有权限
在频道中发送一条测试消息
向 @VersaToolsBot 转发这条消息
获得频道 ID（示例：-1001234567890）
获取频道 ID

注意

频道 ID 前面有 - 号时需要保留
Bot 必须具有频道管理员权限

## .env.example

将 .env.example 里面的参数改成自己的参数，并且将.env.example 改成.env

## cloudflare workers 部署

### 第一步：Fork 项目

访问 CloudFlare ImgBed 项目
点击右上角的 "Fork" 按钮
选择您的 GitHub 账户
确认 Fork 完成

### 访问 Cloudflare Dashboard

登录 Cloudflare Dashboard
选择左侧菜单的 "计算和AI" -> "Workers & Pages"
点击 "创建应用程序"
在最下方 Looking to deploy Pages? 选择 "Get started"
在 "导入现有 Git 存储库" 处点击 "开始使用"

### 配置参数

点击项目进入设置->变量和机密->添加.env.example里的参数->重新部署
