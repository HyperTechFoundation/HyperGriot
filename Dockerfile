# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

VOLUME ["/app/data"]

EXPOSE 8080

CMD ["node", "dist/index.js"]
