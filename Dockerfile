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
RUN pnpm deploy --filter=web --prod /prod/web
>>>>>>> 96dfbdf0 (docker: Add web frontend to Dockerfile)

FROM base AS api
WORKDIR /app

COPY --from=build --chown=node:node /prod/api /app
COPY --from=build --chown=node:node /app/.git /app/.git


USER node

EXPOSE 9000
CMD [ "node", "src/cobalt" ]

# Web frontend

FROM base AS web
WORKDIR /app

COPY --from=build --chown=node:node /prod/web /app

USER node
EXPOSE 3000

CMD ["pnpm", "run", "preview", "--host"]
