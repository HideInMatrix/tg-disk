# Build 阶段
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./
RUN pnpm i

# 复制项目文件
COPY . ./

# 构建项目
RUN pnpm run build

# 生产环境镜像
FROM node:22-alpine
WORKDIR /app

# 只需要 .output 文件夹
COPY --from=build /app/.output/ ./

# 设置端口和主机
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["node", "/app/server/index.mjs"]