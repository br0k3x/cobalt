FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ARG WEB_DEFAULT_API
ARG WEB_HOST

FROM base AS build
WORKDIR /app
COPY . /app

RUN corepack enable
RUN apk add --no-cache python3 alpine-sdk

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

RUN pnpm deploy --filter=@imput/cobalt-api --prod /prod/api
RUN pnpm deploy --filter=@imput/cobalt-web /prod/web

# Build the web app
FROM base AS web-builder
WORKDIR /app

ARG WEB_DEFAULT_API
ARG WEB_HOST

ENV WEB_DEFAULT_API=$WEB_DEFAULT_API
ENV WEB_HOST=$WEB_HOST
ENV WEB_ADAPTER=node

COPY --from=build /prod/web /app
COPY --from=build /app/.git /app/.git

RUN corepack enable && corepack install -g pnpm@9.6.0
RUN pnpm run build

FROM base AS api
WORKDIR /app

COPY --from=build --chown=node:node /prod/api /app
COPY --from=build --chown=node:node /app/.git /app/.git

USER node

EXPOSE 9010
CMD [ "node", "src/cobalt" ]

# Web frontend

FROM node:24-alpine AS web
WORKDIR /app

ENV PORT=3000

COPY --from=web-builder --chown=node:node /app/build /app

USER node
EXPOSE 3000

CMD ["node", "/app"]
