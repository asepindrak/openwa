# Multi-stage build for OpenWA
# Builder stage: install dependencies and build the Next frontend
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies before copying most source files for better caching
COPY package*.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

# Copy application sources and build
COPY . .
RUN npm run build

# Runtime stage: install production dependencies only
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci --omit=dev

# Copy build output and runtime app files
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/server ./server
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/web/.next ./web/.next
COPY --from=builder /app/web/public ./web/public
COPY --from=builder /app/web/next.config.js ./web/next.config.js

# Ensure storage path exists when container starts
RUN mkdir -p /app/storage/database

ENV NODE_ENV=production
EXPOSE 55111 55222
CMD ["npm", "start"]
