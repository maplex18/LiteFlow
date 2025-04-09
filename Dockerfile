FROM node:18-alpine AS base

FROM base AS deps

# Install necessary packages
RUN apk add --no-cache libc6-compat curl

WORKDIR /app

COPY package.json yarn.lock ./

# Clean yarn cache and use Japanese/Asia-Pacific mirrors
RUN echo "Cleaning yarn cache and configuring for Japan region" && \
    yarn cache clean && \
    yarn config set network-timeout 1200000 && \
    yarn config set network-concurrency 1 && \
    # Try Japanese/Asia-Pacific mirrors first
    (yarn config set registry 'https://registry.npmjs.org/' && \
    YARN_NETWORK_TIMEOUT=1200000 yarn install --network-timeout 1200000 --network-concurrency 1 --no-progress) || \
    # If that fails, try another approach with cache cleaning
    (echo "First attempt failed, cleaning cache and trying again" && \
    yarn cache clean && \
    yarn config set registry 'https://registry.npmjs.org/' && \
    YARN_NETWORK_TIMEOUT=1200000 yarn install --network-timeout 1200000 --network-concurrency 1 --no-progress --frozen-lockfile) || \
    # Last resort - try with minimal dependencies
    (echo "Second attempt failed, trying with --production=false" && \
    yarn cache clean && \
    yarn config set registry 'https://registry.npmjs.org/' && \
    YARN_NETWORK_TIMEOUT=1200000 yarn install --network-timeout 1200000 --network-concurrency 1 --no-progress --production=false)

FROM base AS builder

RUN apk update && apk add --no-cache git

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build with extended timeout
RUN YARN_NETWORK_TIMEOUT=1200000 yarn build --network-timeout 1200000

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