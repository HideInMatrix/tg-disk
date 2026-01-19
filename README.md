# TG 网盘

使用 Telegram 编写的个人网盘项目，主要存放一些小文件。

## 技术框架

- Nuxt4

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
获得频道 ID（示例：-1234567890123）
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

## 接口文档

### 认证接口

#### POST `/api/auth`

用户登录接口

**请求参数：**

```json
{
  "account": "user@example.com",
  "password": "password123"
}
```

**响应参数：**

- 登录成功：`{ "code": 200, "data": true }`
- 登录失败：`{ "code": 401, "data": false }`

**说明：**

- 账号密码从环境变量 `PUBLIC_ACCOUNT` 和 `PUBLIC_PASSWORD` 获取
- 如果未配置环境变量，则任何请求都会登录成功
- 登录成功后会设置用户 Session，有效期为 7 天

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
    "message_id": 123
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
    "message_id": 123
  }
}
```

---

### IPFS 文件上传

#### POST `/api/ipfs/send`

上传文件到 IPFS

**请求参数（FormData）：**

| 字段     | 类型   | 必填 | 说明         |
| -------- | ------ | ---- | ------------ |
| file     | File   | ✓    | 要上传的文件 |
| fileName | string | ✓    | 文件名       |
| deviceId | string | -    | 设备 ID      |

**请求示例：**

```bash
curl -X POST http://localhost:3000/api/ipfs/send \
  -F "file=@/path/to/file.pdf" \
  -F "fileName=document.pdf" \
  -F "deviceId=device-123"
```

**JavaScript 示例：**

```javascript
const formData = new FormData();
formData.append("file", fileBlob); // File 对象
formData.append("fileName", "document.pdf");
formData.append("deviceId", "device-123");

const response = await fetch("/api/ipfs/send", {
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
    "cid": "QmXxxx...",
    "file_name": "document.pdf",
    "file_size": 102400
  }
}
```
