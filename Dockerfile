# WYE 一站式镜像：构建前端产物 + 运行 Node 服务（同时提供 API 与页面）
# 构建：docker build -t wye:latest .
# 运行：docker run -d -p 8080:8080 -v wye-data:/app/wye-server/data wye:latest
# 换库：docker build --build-arg DB_PROVIDER=mysql -t wye:mysql .

FROM node:20-slim AS base
# pnpm 用 corepack 提供；prisma 在 debian 上需要 openssl
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ---------- 依赖安装 ----------
FROM base AS deps
WORKDIR /app
# prisma/ 必须在 install 之前就位：wye-server 的 postinstall 会执行 prisma generate
COPY package.json ./
COPY wye-server/package.json wye-server/
COPY wye-server/prisma wye-server/prisma
COPY wye-frontend/package.json wye-frontend/
# Prisma 的 provider 只支持字面量，换库必须在生成 Client 之前改写 schema
ARG DB_PROVIDER=sqlite
RUN set -eux; \
    if [ "$DB_PROVIDER" != "sqlite" ]; then \
      sed -i "s/provider = \"sqlite\"/provider = \"$DB_PROVIDER\"/" wye-server/prisma/schema.prisma; \
      grep -q "provider = \"$DB_PROVIDER\"" wye-server/prisma/schema.prisma; \
    fi; \
    pnpm install --no-frozen-lockfile \
    && cd wye-server && pnpm install --no-frozen-lockfile \
    && cd ../wye-frontend && pnpm install --no-frozen-lockfile

# ---------- 构建前端 ----------
FROM deps AS build
WORKDIR /app
COPY wye-frontend ./wye-frontend
RUN cd wye-frontend && pnpm build

# ---------- 运行 ----------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    WYE_WEB_DIST=/app/web \
    WYE_AUTO_MIGRATE=true \
    WYE_SEED=true \
    TZ=Asia/Shanghai

WORKDIR /app
# node_modules 已包含 prisma CLI（运行时需要执行 prisma db push 建表）
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/wye-server/node_modules ./wye-server/node_modules
COPY wye-server ./wye-server
# 用 deps 阶段改写过的 schema 覆盖源码里的（必须与已生成的 Prisma Client 方言一致）
COPY --from=deps /app/wye-server/prisma ./wye-server/prisma
COPY --from=build /app/wye-frontend/dist ./web
COPY package.json ./

EXPOSE 8080
# SQLite 数据落在挂载卷里，容器重建不丢数据（用 MySQL/Postgres 时该卷可忽略）
VOLUME ["/app/wye-server/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/api/health || exit 1

CMD ["node", "wye-server/src/server.js"]
