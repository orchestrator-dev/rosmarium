FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy root configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json tsconfig.base.json ./

# Copy all packages and apps (since server relies on local workspace packages)
COPY packages/ ./packages/
COPY apps/rosmarium-server/ ./apps/rosmarium-server/

# Install dependencies (respecting workspaces)
RUN pnpm install --frozen-lockfile

# Build the server and its dependencies
RUN pnpm --filter @orchestrator.dev/server build

# Production image
FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

ENV NODE_ENV=production

# Copy built artifacts and necessary files from builder
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/rosmarium-server/package.json ./apps/rosmarium-server/
COPY --from=builder /app/apps/rosmarium-server/dist/ ./apps/rosmarium-server/dist/

# Only install production dependencies
RUN pnpm install --prod --frozen-lockfile

WORKDIR /app/apps/rosmarium-server

EXPOSE 8000

CMD ["node", "dist/index.js"]
