FROM node:18-alpine

WORKDIR /app

# Tools for native module builds (e.g., bcrypt), curl for healthchecks, and Chromium deps for Puppeteer PDF
RUN apk add --no-cache \
  python3 make g++ curl \
  chromium nss freetype harfbuzz ca-certificates ttf-freefont \
  wqy-zenhei && \
  apk add --no-cache --repository http://dl-cdn.alpinelinux.org/alpine/v3.16/main libssl1.1

# TODO: Replace libssl1.1 compatibility hack with a proper runtime base (e.g. debian-slim or Alpine + OpenSSL 3 Prisma engine)

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
EXPOSE 3030

CMD ["npm", "run", "start:docker"]
