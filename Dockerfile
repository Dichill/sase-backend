# ---------- Base ----------
    ARG NODE_IMAGE=node:20-alpine
    ARG PNPM_VERSION=9.10.0
    
    # ---------- deps (dev+prod) ----------
    FROM ${NODE_IMAGE} AS deps
    WORKDIR /app
    RUN apk add --no-cache libc6-compat
    RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
    COPY package.json pnpm-lock.yaml ./
    RUN pnpm install --frozen-lockfile
    
    # ---------- build ----------
    FROM ${NODE_IMAGE} AS builder
    WORKDIR /app
    RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    # expects "build": "nest build"
    RUN pnpm build
    
    # ---------- prod deps only ----------
    FROM ${NODE_IMAGE} AS prod-deps
    WORKDIR /app
    RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
    COPY package.json pnpm-lock.yaml ./
    RUN pnpm install --frozen-lockfile --prod
    
    # ---------- runtime ----------
    FROM ${NODE_IMAGE} AS runner
    WORKDIR /app
    ENV NODE_ENV=production
    ENV PORT=3000
    # non-root user
    RUN addgroup -S app && adduser -S app -G app
    USER app
    
    COPY --from=prod-deps /app/node_modules ./node_modules
    COPY --from=builder   /app/dist        ./dist
    COPY package.json ./
    
    EXPOSE 3000
    CMD ["node", "dist/main.js"]
    