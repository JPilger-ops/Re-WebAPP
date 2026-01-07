# syntax=docker/dockerfile:1.4
########################################
# Frontend build stage (Vite → backend/public)
########################################
FROM node:18-bookworm-slim AS frontend

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend ./
# Vite schreibt nach ../backend/public (siehe vite.config.ts)
RUN mkdir -p /app/backend/public && npm run build

########################################
# Backend build stage
########################################
FROM node:18-bookworm-slim AS build

WORKDIR /app/backend

ARG BUILD_SHA=unknown
ARG BUILD_TIME=unknown
ARG BUILD_NUMBER=0
ARG APP_VERSION=0.0.0

ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_TIME=${BUILD_TIME}
ENV BUILD_NUMBER=${BUILD_NUMBER}
ENV APP_VERSION=${APP_VERSION}

# Install build tools (für bcrypt etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 build-essential ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY backend ./

# Generate Prisma client + build TS
RUN npx prisma generate && npm run build

# Prune devDependencies for runtime
RUN npm prune --omit=dev

########################################
# Runtime stage
########################################
FROM node:18-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Puppeteer/Chromium deps
RUN apt-get update && apt-get install -y --no-install-recommends \
  chromium \
  curl \
  nfs-common \
  postgresql-client \
  ca-certificates \
  fonts-liberation \
  libatk-bridge2.0-0 libatk1.0-0 \
  libcups2 \
  libdrm2 libgbm1 \
  libgtk-3-0 \
  libnss3 \
  libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
  libasound2 \
  libpango-1.0-0 libcairo2 \
  xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Copy node_modules and built assets
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/public ./public
# Overlay with freshly built frontend assets
COPY --from=frontend /app/backend/public ./public
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/migrations ./migrations
COPY --from=build /app/backend/scripts ./scripts
COPY --from=build /app/backend/build-info.json ./build-info.json
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Ensure pdf output dir exists (volume may override)
RUN mkdir -p /app/pdfs

ARG BUILD_SHA=unknown
ARG BUILD_TIME=unknown
ARG BUILD_NUMBER=0
ARG APP_VERSION=0.0.0

ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_TIME=${BUILD_TIME}
ENV BUILD_NUMBER=${BUILD_NUMBER}
ENV APP_VERSION=${APP_VERSION}

EXPOSE 3030

CMD ["npm", "run", "start:docker"]
