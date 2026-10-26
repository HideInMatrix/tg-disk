# TG 网盘

使用 Telegram 编写的个人网盘项目，主要存放一些小文件。

## 技术框架

- Nuxt4

### 特色

1. 无限存储网盘
2. Telegram 存储，可选 Cloudflare R2 对象存储
3. 防盗措施
4. 可选：Cloudflare D1 + KV 后台文件管理（记录 / 搜索 / 删除 / 重命名 / 标签）

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
获得频道 ID（示例：-1234567890123）
获取频道 ID

注意

频道 ID 前面有 - 号时需要保留
Bot 必须具有频道管理员权限

## 网页登录与 API Key 认证

网页登录使用账号密码，第三方平台 / Agent / 脚本使用独立的 API Key，两种方式互不依赖。在服务器 `.env`（Cloudflare Pages 则在变量和机密中设置为 Secret）配置：

```dotenv
NUXT_ACCOUNT=请自行填写登录账号
NUXT_PASSWORD=请自行填写登录密码
NUXT_SESSION_PASSWORD=请自行填写不同的长随机字符串
# 可选，仅第三方接口调用需要，至少32字符
NUXT_API_KEY=请自行填写至少32字符的私密APIKey
```

浏览器访问 `/login`，输入账号密码后获得会话 Cookie，上传与文件管理使用该 Cookie，不需要 API Key。外部程序直接通过请求头 `X-API-Key: <你的 API Key>` 调用接口，无需登录。API Key 不能用于 `/api/auth` 换取网页登录会话。**不要把 API Key 放进公开分发的客户端应用或第三方网页。**

旧的 `NUXT_PUBLIC_ACCOUNT`、`NUXT_PUBLIC_PASSWORD` 仍兼容读取，但只进入服务端配置，不再写入浏览器运行时配置；推荐迁移到 `NUXT_ACCOUNT`、`NUXT_PASSWORD`。`NUXT_SESSION_PASSWORD` 至少 32 字符。未配置 API Key 不影响账号密码登录；未登录且没有有效 API Key 时，敏感接口拒绝操作。请确保全站使用 HTTPS，修改配置后重新部署。如需立刻撤销已有会话，还应轮换 `NUXT_SESSION_PASSWORD`。

## .env.example

复制 `.env.example` 为 `.env`，填写服务器专用机密以及所需的存储服务配置。

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

1. 构建命令使用 `pnpm run build`，构建输出目录为 `dist`（Pages 环境自动选择 `cloudflare_pages` preset）。
2. 设置 → 变量和机密：按 `.env.example` 配置账号密码和 `NUXT_SESSION_PASSWORD`；按需设置第三方接口的 `NUXT_API_KEY`。密码和密钥使用 Secret，会话密钥和 API Key 至少 32 字符。
3. **设置 → 运行时 → 兼容性标志：添加 `nodejs_compat`**。本项目 API Key 校验使用 `node:crypto` 的 `timingSafeEqual`；使用 `2025-12-06` 等兼容日期时，未开启此标志会在 Function 发布阶段报 `No such module "node:crypto"`。保留现有兼容日期即可，无需额外安装 `crypto` 包。
4. 设置 → 绑定：保留已配置的 R2 存储桶绑定（见下文）。
5. 保存后重新部署，在部署详情确认发布成功；仅看到 `Assets published` 不表示 Function 已发布。

生产和预览环境的兼容标志分别配置。为保留面板中的变量、密钥和桶绑定，本仓库不启用 Nitro `cloudflare.deployConfig`，也不新增接管生产配置的 Wrangler 文件。官方说明：[Node.js 兼容模式](https://developers.cloudflare.com/workers/runtime-apis/nodejs/#get-started)、[Pages 配置迁移注意事项](https://developers.cloudflare.com/pages/functions/wrangler-configuration/#migrate-from-dashboard-configuration)。

发布前本地验证：

```bash
pnpm test
NITRO_PRESET=cloudflare_pages pnpm build
pnpm test:pages-r2
```

最后一项使用测试专用账号密码、API Key 和内存桶，不访问生产 R2，验证状态接口、SSR hydration、账号密码登录、Cookie / API Key 上传鉴权与私有桶读取。Node 下的模拟测试不能替代 Cloudflare 运行时兼容检查，发布仍须确认面板里的 `nodejs_compat`。

上传使用当前站点的相对路径 `/api/telegram/send`，没有固定的 Pages 域名。通过 CDN / 反向代理访问自定义域名时，错误 JSON 中的 `url` 可能是回源 Host 对应的 Pages 地址；实际浏览器请求以开发者工具 Network 中的 Request URL 为准。`NUXT_PUBLIC_ALLOW_HOSTS` 是文件访问白名单，不用于指定上传地址。

## （可选）Cloudflare D1 + KV 文件索引与后台管理

默认情况下上传结果只保留在当前页面，刷新即丢失。配置 Cloudflare D1 + KV 后，会记录每次上传的元数据，并在 `/files` 提供后台管理（浏览、搜索、分页、预览、复制直链、删除、重命名、标签）。**不配置则对现有功能零影响。**

- **D1**（SQL 数据库）作为文件索引主库；**KV** 存运行时“管理范围”开关。免费额度：D1 5GB / 500 万行读每天 / 10 万行写每天；KV 10 万读每天 / 1000 写每天。
- 应用自托管（非 Cloudflare 部署），通过 D1/KV 的 REST API 访问，需要一个 API Token。
- 默认索引全部 2 种上传方式（Telegram、R2），可在后台或用 `NUXT_PUBLIC_FILE_INDEX_PROVIDERS` 分别开关。

### 启用步骤

1. 安装并登录 wrangler：`pnpm dlx wrangler login`
2. 创建 D1 数据库并初始化表：
   ```bash
   pnpm dlx wrangler d1 create tg-disk-index          # 记下输出的 database_id
   pnpm dlx wrangler d1 execute tg-disk-index --remote --file=./server/db/schema.sql
   ```
   （也可跳过初始化，应用首次写入时会自动建表。）
3. 创建 KV 命名空间：`pnpm dlx wrangler kv namespace create tg-disk-settings`（记下 namespace_id）
4. 在 Cloudflare Dashboard → My Profile → API Tokens 创建自定义 Token，权限：**Account · D1 · Edit** 与 **Account · Workers KV Storage · Edit**。
5. 账户 ID 可在 Dashboard 右侧或用 `wrangler whoami` 获取。
6. 配置环境变量（见 `.env.example`）：
   ```
   NUXT_CF_ACCOUNT_ID=...
   NUXT_CF_API_TOKEN=...
   NUXT_CF_D1_DATABASE_ID=...
   NUXT_CF_KV_NAMESPACE_ID=...
   # 可选：默认全开
   NUXT_PUBLIC_FILE_INDEX_PROVIDERS=telegram,r2
   ```
7. 重启应用。登录后首页右上角出现「文件管理」入口（`/files`）。

> 四项 `NUXT_CF_*` 都配置才会启用。文件管理和上传写入接口要求账号密码登录会话或有效的 `X-API-Key`，不会因未配置 API Key 而允许匿名写入。

### 说明与限制

- 索引从启用后开始累积，启用前上传的历史文件不会自动进入索引。
- 删除 Telegram 文件会尝试调用 `deleteMessage` 删除频道消息（依赖启用后新捕获的 `message_id`）。
- 删除 R2 文件会尝试删除存储桶中的对象；删除失败时会提示原因，但索引记录仍会移除。

### 文件索引接口（需启用；始终要求 API Key 请求头或已验证的网页登录会话）

| 方法   | 路径                                    | 说明                                     |
| ------ | --------------------------------------- | ---------------------------------------- |
| GET    | `/api/files?page&pageSize&provider&q`   | 分页列出（provider 过滤、文件名搜索）    |
| POST   | `/api/files`                            | 记录上传（前端上传成功后自动调用）       |
| PATCH  | `/api/files/:id`                        | 重命名 / 标签                            |
| DELETE | `/api/files/:id`                        | 删除记录（Telegram 尽力删消息）          |
| GET    | `/api/files/settings`                   | 读取 provider 允许列表与受管开关         |
| PUT    | `/api/files/settings`                   | 保存受管 provider 开关                   |

## （可选）Cloudflare R2 对象存储上传

除 Telegram 外，可选启用 **Cloudflare R2** 作为一个上传存储点（文件真正存到你的 R2 存储桶）。上传页始终显示 **Cloudflare R2** 标签；未配置时显示配置提示并禁用上传，配置后即可使用。若同时启用了 D1 索引，R2 文件也会纳入 `/files` 后台管理，且**删除会真正删除 R2 对象**。不配置则不影响现有功能。

### Cloudflare Pages：使用原生 R2 绑定（推荐）

1. 在 R2 面板创建存储桶（例如 `tg-disk`），保持私有，不需要开启公共访问。
2. 打开 Pages 项目 → **设置 → 绑定 → 添加 → R2 存储桶**。
3. 绑定名称填写 **`NUXT_R2_BUCKET`**（也支持 `R2_BUCKET`），选择 `tg-disk`。
4. 对要使用的生产 / 预览环境分别配置绑定，再重新部署。
5. 打开 `/api/files/status`，`r2Enabled: true` 即表示当前请求识别到了绑定。

**原生绑定不需要 `NUXT_R2_ACCESS_KEY_ID`、`NUXT_R2_SECRET_ACCESS_KEY` 或 R2 的账户 ID。** 绑定通过当前请求的 `event.context.cloudflare.env`（本项目使用 Nitro 2）提供 `R2Bucket` 对象；上传、读取和删除直接调用桶的 `put/get/delete`，不经过 S3 签名。读取仍通过本站 `/r2/<key>` 流式代理，并保持登录及防盗链逻辑。

官方文档：[Pages Functions 绑定](https://developers.cloudflare.com/pages/functions/bindings/#r2-buckets)、[Nitro 2 的 Cloudflare 请求上下文](https://v2.nitro.build/deploy/providers/cloudflare#direct-access-to-cloudflare-bindings)。

> `.env` 中的 `NUXT_R2_BUCKET=tg-disk` 只是 S3 模式的桶名字符串，不会创建或模拟原生绑定。需要在本地测试绑定时，可使用 `NITRO_PRESET=cloudflare_pages pnpm build`，再运行 `pnpm dlx wrangler pages dev dist --r2=NUXT_R2_BUCKET`，使用 Wrangler 的本地模拟桶。

本地回归验证（不访问真实桶）：`pnpm test`；再执行 `NITRO_PRESET=cloudflare_pages pnpm build && pnpm test:pages-r2`，使用内存 mock binding 验证构建后的 Pages Worker 状态、首页 SSR hydration、上传与读取。

### 自托管 / 普通 Node：S3 兼容 API（保留兼容）

没有原生绑定时才回退到 S3 模式，使用 `aws4fetch` 做 SigV4 签名。

1. 在 R2 的 API 令牌面板创建仅允许目标桶对象读写的凭据。
2. 设置以下环境变量后重启：
   ```
   NUXT_CF_ACCOUNT_ID=...
   NUXT_R2_ACCESS_KEY_ID=...
   NUXT_R2_SECRET_ACCESS_KEY=...
   NUXT_R2_BUCKET=tg-disk
   ```
3. 上传页选择 **Cloudflare R2** 标签；“未配置”提示消失后即可使用。

原生绑定始终优先；绑定操作失败不会切换到另一套 S3 凭据，避免误写不同的桶。

> R2 和 Telegram 上传接口均要求 API Key 请求头或已经验证的网页会话，避免匿名写入。

## 接口文档

### 认证接口

#### POST `/api/auth`

浏览器账号密码登录接口，使用服务端配置的账号密码；API Key 仅用于第三方接口请求头。

**请求参数：**

```json
{
  "account": "YOUR_ACCOUNT",
  "password": "YOUR_PASSWORD"
}
```

**响应参数：**

- 验证成功（HTTP 200）：`{ "code": 200, "data": true }`
- 账号或密码不正确：HTTP 401
- 服务端未配置账号密码：HTTP 503

**说明：**

- 账号、密码与 `NUXT_API_KEY` 都是服务端私有配置，不写入数据库、不暴露给浏览器运行时配置。
- 外部程序使用 `X-API-Key` 请求头调用上传和文件管理接口，无需通过 `/api/auth` 登录。
- Telegram Bot Token 仍从服务端私有变量 `NUXT_TG_TOKEN` 获取。
- 登录成功后设置有效期 7 天的会话；轮换密钥后要立即失效已有会话时，同时轮换 `NUXT_SESSION_PASSWORD`。

---

### Telegram 文件上传

#### POST `/api/telegram/send`

上传文件到 Telegram

**请求参数（FormData）：**

| 字段     | 类型   | 必填 | 说明                                   |
| -------- | ------ | ---- | -------------------------------------- |
| file     | File   | ✓    | 要上传的文件                           |
| fileName | string | ✓    | 文件名                                 |
| chatId   | string | ✓    | Telegram 频道 ID（如：-1234567890123） |
| caption  | string | -    | 文件描述/备注                          |
| deviceId | string | -    | 设备 ID                                |

**请求示例：**

```bash
curl -X POST http://localhost:3000/api/telegram/send \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "file=@/path/to/file.pdf" \
  -F "fileName=document.pdf" \
  -F "chatId=-1234567890123" \
  -F "caption=My Document"
```

**JavaScript 示例：**

```javascript
const formData = new FormData();
formData.append("file", fileBlob); // File 对象
formData.append("fileName", "document.pdf");
formData.append("chatId", "-1234567890123");
formData.append("caption", "My Document");

const response = await fetch("/api/telegram/send", {
  method: "POST",
  body: formData,
});
const data = await response.json();
```

**响应参数：**

```json
{
  "code": 200,
  "data": {
    "file_id": "AgACAgIAAxkBAAI...",
    "file_name": "document.pdf",
    "file_size": 102400,
    "message_id": 123,
    "chat_id": -1234567890123
  }
}
```

---

### Telegram URL 上传

#### POST `/api/telegram/url`

上传 URL 文件到 Telegram

**请求参数（FormData）：**

| 字段     | 类型   | 必填 | 说明             |
| -------- | ------ | ---- | ---------------- |
| file     | string | ✓    | 文件 URL 地址    |
| fileName | string | ✓    | 文件名           |
| chatId   | string | ✓    | Telegram 频道 ID |
| caption  | string | -    | 文件描述/备注    |
| deviceId | string | -    | 设备 ID          |

**请求示例：**

```bash
curl -X POST http://localhost:3000/api/telegram/url \
  -F "file=https://example.com/document.pdf" \
  -F "fileName=document.pdf" \
  -F "chatId=-1234567890123" \
  -F "caption=My Document"
```

**JavaScript 示例：**

```javascript
const formData = new FormData();
formData.append("file", "https://example.com/document.pdf");
formData.append("fileName", "document.pdf");
formData.append("chatId", "-1234567890123");
formData.append("caption", "My Document");

const response = await fetch("/api/telegram/url", {
  method: "POST",
  body: formData,
});
const data = await response.json();
```

**响应参数：**

```json
{
  "code": 200,
  "data": {
    "file_id": "AgACAgIAAxkBAAI...",
    "file_name": "document.pdf",
    "file_size": 102400,
    "message_id": 123,
    "chat_id": -1234567890123
  }
}
```

---

### Cloudflare R2 文件上传

#### POST `/api/r2/send`

需配置 R2。配置了账号密码时需登录，上传页单文件上限 100 MiB。

**请求参数（FormData）：**

| 字段     | 类型   | 必填 | 说明         |
| -------- | ------ | ---- | ------------ |
| file     | File   | ✓    | 要上传的文件 |
| fileName | string | -    | 文件名，默认使用上传文件名 |

```javascript
const formData = new FormData();
formData.append("file", fileBlob);
formData.append("fileName", "document.pdf");
const response = await fetch("/api/r2/send", { method: "POST", body: formData });
const result = await response.json();
// result.code === 200 时，通过 /r2/<file_id> 读取文件。
```

```json
{
  "code": 200,
  "msg": "ok",
  "data": {
    "file_id": "<uuid>.pdf",
    "file_name": "document.pdf",
    "file_size": 102400
  }
}
```
