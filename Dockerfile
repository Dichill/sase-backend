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
ENV PORT=4000
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV MAX_FILE_SIZE=52428800

# Install Chromium and necessary dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# non-root user
RUN addgroup -S app && adduser -S app -G app

# Create generated-pdfs directory with proper permissions BEFORE switching to non-root user
RUN mkdir -p /app/generated-pdfs && chown -R app:app /app/generated-pdfs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder   /app/dist        ./dist
COPY package.json ./

# Switch to non-root user AFTER setting up directories and permissions
USER app
    
    EXPOSE 4000
    CMD ["node", "dist/main.js"]
    