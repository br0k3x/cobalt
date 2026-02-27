FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

FROM base AS build
WORKDIR /app
COPY . /app

RUN corepack enable
RUN apk add --no-cache python3 alpine-sdk

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

<<<<<<< HEAD
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm deploy --filter=@imput/cobalt-api --prod /prod/api
=======
RUN pnpm deploy --filter=@imput/cobalt-api --prod /prod/api
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
RUN pnpm deploy --filter=web --prod /prod/web
>>>>>>> 96dfbdf0 (docker: Add web frontend to Dockerfile)
=======
RUN pnpm deploy --filter=@br0k3x/cobalt --prod /prod/web
>>>>>>> a4274244 (docker: Fix (i hope))
=======
RUN pnpm deploy --filter=@imput/cobalt-web --prod /prod/web
>>>>>>> 1862fd9b (Docker: Fix v2 (hopes again))
=======
RUN pnpm deploy --filter=@imput/cobalt-web /prod/web

# Build the web app
FROM base AS web-builder
WORKDIR /app

COPY --from=build /prod/web /app

RUN corepack enable && corepack install -g pnpm@9.6.0
RUN pnpm run build
>>>>>>> e77b0355 (docker: fix v4)

FROM base AS api
WORKDIR /app

COPY --from=build --chown=node:node /prod/api /app
COPY --from=build --chown=node:node /app/.git /app/.git

USER node

EXPOSE 9000
CMD [ "node", "src/cobalt" ]

# Web frontend

FROM node:24-alpine AS web
WORKDIR /app

RUN npm install -g http-server

COPY --from=web-builder /app/build /app

USER node
EXPOSE 3000

CMD ["http-server", "/app", "-p", "3000"]
