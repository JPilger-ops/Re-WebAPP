FROM node:18-alpine

WORKDIR /app

# Tools for native module builds (e.g., bcrypt), curl for healthchecks, and Chromium deps for Puppeteer PDF
RUN apk add --no-cache \
  python3 make g++ curl \
  chromium nss freetype harfbuzz ca-certificates ttf-freefont \
  wqy-zenhei

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
EXPOSE 3030

CMD ["npm", "run", "start:docker"]
