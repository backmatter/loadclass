FROM node:26-slim

WORKDIR /app
ENV NODE_ENV=development

RUN npm install --global pnpm@12.16.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/registry-contract/package.json packages/registry-contract/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/cli/package.json apps/cli/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY apps/web apps/web
COPY apps/api apps/api
COPY packages/db packages/db
COPY packages/registry-contract packages/registry-contract

ENV NODE_ENV=production

RUN pnpm --dir apps/web build

WORKDIR /app/apps/web
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
