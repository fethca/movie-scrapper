ARG DOCKER_REGISTRY=""

##### BASE NODE IMAGE #######

FROM node:24-slim AS base

WORKDIR /usr/app

##### SET UP PNPM ######

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

#####  Source stage ######

FROM base AS source

COPY pnpm-lock.yaml ./
COPY package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --production=false
COPY types ./types
COPY src ./src

#####  Dependencies stage ######

FROM source AS dependencies

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --production --ignore-scripts

### Test stage #####

FROM source AS test

COPY tsconfig.json ./
COPY vitest.config.ts ./
COPY tests ./tests
RUN pnpm vitest run --coverage

#### Build stage ####

FROM source AS build

COPY tsconfig.json ./
COPY tsconfig.build.json ./
RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm build

###### Release stage #####

FROM base AS release

COPY --from=source --chown=node:node /usr/app/package.json /usr/app/package.json
COPY --from=dependencies --chown=node:node /usr/app/node_modules/ /usr/app/node_modules/
COPY --from=build --chown=node:node /usr/app/dist/ /usr/app/dist/

USER node

CMD ["node", "/usr/app/dist/index.js"]
