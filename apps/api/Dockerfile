FROM oven/bun:1.3.9-slim

WORKDIR /app
ENV NODE_ENV=development

COPY package.json bun.lock tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/cli/package.json apps/cli/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/registry-contract/package.json packages/registry-contract/package.json

RUN bun install --frozen-lockfile --ignore-scripts

COPY apps/api apps/api
COPY packages/db packages/db
COPY packages/registry-contract packages/registry-contract

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 8080

CMD ["bun", "src/index.ts"]
