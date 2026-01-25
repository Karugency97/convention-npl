FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install backend dependencies
RUN npm ci --only=production=false

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm ci

# Copy source code
WORKDIR /app
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build backend
RUN npm run build

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install Chromium for Puppeteer in production
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

# Copy built assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/frontend/dist ./dist/public

EXPOSE 3000

# Run migrations and start the app
CMD ["node", "dist/main.js"]
