# Stage 1: Base - Install dependencies only when needed
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Stage 2: Dependencies - Install node_modules using reproducible npm ci
FROM base AS deps
COPY package*.json ./
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci --prefer-offline

# Stage 3: Development - Hot-reloading environment
FROM base AS development
ENV NODE_ENV=development
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
COPY . .
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Stage 4: Builder - Build the production application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ARG BACKEND_INTERNAL_URL="http://backend:80"
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
ARG NEXT_PUBLIC_ENABLE_DEMO_MODE="true"
ENV NEXT_PUBLIC_ENABLE_DEMO_MODE=$NEXT_PUBLIC_ENABLE_DEMO_MODE
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 5: Runner - Minimal secure production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Security: Run as unprivileged user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Static files and standalone build artifacts
COPY --from=builder /app/public ./public

# Set up prerender cache directory with proper ownership
RUN mkdir .next && chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
