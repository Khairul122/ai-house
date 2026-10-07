FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-workspace.yaml biome.json ./
COPY packages ./packages
COPY apps ./apps
COPY house ./house
RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm
COPY --from=builder /app ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@ai-house/api", "start"]
