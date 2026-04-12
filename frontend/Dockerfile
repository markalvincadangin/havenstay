# Frontend Dockerfile for Next.js
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app to ensure all env vars are baked in correctly
RUN npm run build

# Expose port
EXPOSE 3000

# Start Next.js
CMD ["npm", "start"]
