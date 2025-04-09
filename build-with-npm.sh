#!/bin/bash

# This script builds the Docker image using npm instead of yarn
# This can sometimes help with network issues

echo "Creating a temporary Dockerfile.npm..."

# Create a temporary Dockerfile that uses npm instead of yarn
cat > Dockerfile.npm << 'EOF'
FROM node:18-alpine AS base

FROM base AS deps

# Install necessary packages
RUN apk add --no-cache libc6-compat curl

WORKDIR /app

COPY package.json package-lock.json* ./

# Clean npm cache and install dependencies with npm
RUN echo "Cleaning npm cache and installing dependencies" && \
    npm cache clean --force && \
    npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-timeout 1200000 && \
    npm config set fetch-retry-mintimeout 60000 && \
    npm config set fetch-retry-maxtimeout 180000 && \
    npm config set fetch-retries 10 && \
    npm config set strict-ssl false && \
    npm config set progress false && \
    npm config set maxsockets 3 && \
    npm config set network-concurrency 1 && \
    npm config set node-options --max-old-space-size=4096 && \
    (echo "First attempt - trying with minimal concurrency..." && \
     npm install --no-fund --no-audit --loglevel verbose --prefer-offline) || \
    (echo "Second attempt - trying with legacy-peer-deps..." && \
     npm cache clean --force && \
     npm install --no-fund --no-audit --loglevel verbose --legacy-peer-deps --prefer-offline) || \
    (echo "Third attempt - trying with registry.npmmirror.com..." && \
     npm cache clean --force && \
     npm config set registry https://registry.npmmirror.com/ && \
     npm install --no-fund --no-audit --loglevel verbose --legacy-peer-deps --prefer-offline) || \
    (echo "Final attempt - trying with minimal dependencies..." && \
     npm cache clean --force && \
     npm config set registry https://registry.npmjs.org/ && \
     npm install --no-fund --no-audit --loglevel verbose --legacy-peer-deps --production --prefer-offline && \
     npm install --no-fund --no-audit --loglevel verbose --legacy-peer-deps --no-production)

FROM base AS builder

RUN apk update && apk add --no-cache git

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build with npm
RUN npm run build

FROM base AS runner
WORKDIR /app

RUN apk add proxychains-ng

# Use environment variables instead of hardcoded values
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/server ./.next/server

EXPOSE 3000

CMD ["node", "server.js"]
EOF

echo "Creating a temporary docker-compose.npm.yml..."

# Create a temporary docker-compose file
cat > docker-compose.npm.yml << 'EOF'
version: '3.3'
services:
  chatgpt-next-web:
    image: chatgpt-next-web
    build: 
      context: .
      dockerfile: Dockerfile.npm
      args:
        - NODE_OPTIONS=--max-old-space-size=4096
    ports:
      - 80:3000
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - NODE_OPTIONS=--max-old-space-size=4096
    restart: always
EOF

# Create a local .npmrc file with optimized settings
cat > .npmrc.docker << 'EOF'
registry=https://registry.npmjs.org/
fetch-timeout=1200000
fetch-retry-mintimeout=60000
fetch-retry-maxtimeout=180000
fetch-retries=10
strict-ssl=false
progress=false
maxsockets=3
network-concurrency=1
prefer-offline=true
EOF

echo "Building Docker image with npm..."
sudo docker-compose -f docker-compose.npm.yml build --no-cache

if [ $? -eq 0 ]; then
  echo "Build successful! Starting the container..."
  sudo docker-compose -f docker-compose.npm.yml up -d
  echo "Container is now running. You can access it at http://localhost"
else
  echo "Build failed. Please check the logs for more information."
fi 