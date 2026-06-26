# Stage 1: Base - Install dependencies only when needed
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Stage 2: Dependencies - Install node_modules
FROM base AS deps
COPY package*.json ./
# Set long timeouts to prevent ECONNRESET during Docker build on Linux
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install

# Stage 3: Development - Hot-reloading environment
# node_modules are installed in deps, then the bind mount in docker-compose
# overlays /app with host files while an anonymous volume protects /app/node_modules
FROM base AS development
ENV NODE_ENV=development
COPY . .
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Stage 4: Builder - Build the production application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ARG BACKEND_INTERNAL_URL=http://backend
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
RUN npm run build

# Stage 5: Runner - Minimal production image
FROM base AS runner
ENV NODE_ENV=production
# next.config.mjs is required for runtime settings
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# Automatically leverages the library built in the builder stage
COPY --from=builder /app/.next/standalone ./

EXPOSE 3000
# The standalone build provides a server.js file
CMD ["node", "server.js"]
