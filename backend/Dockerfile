FROM node:18-alpine

WORKDIR /app

# Tools for native module builds (e.g., bcrypt) + curl for healthchecks
RUN apk add --no-cache python3 make g++ curl

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3030

CMD ["npm", "run", "start:docker"]
