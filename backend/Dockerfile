########################################
# Build stage
########################################
FROM node:18-bookworm-slim AS build

WORKDIR /app

# Install build tools (for bcrypt etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 build-essential ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

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
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts ./scripts
COPY package*.json ./
COPY tsconfig.json ./

# Ensure pdf output dir exists (volume may override)
RUN mkdir -p /app/pdfs

# Optional: non-root runtime
USER node

EXPOSE 3030

CMD ["npm", "run", "start:docker"]
