FROM hexpm/elixir:1.14.5-erlang-25.3.2.4-alpine-3.18.2 AS builder

WORKDIR /app

RUN apk --no-cache --update add \
    alpine-sdk gmp-dev automake libtool inotify-tools autoconf python3 file gcompat libstdc++ curl ca-certificates git make bash

ENV SECRET_KEY_BASE="RMgI4C1HSkxsEjdhtGMfwAHfyT6CKWXOgzCboJflfSm4jeAlic52io05KB6mqzc5"

RUN apk --update add libstdc++ curl ca-certificates gcompat

ARG CACHE_EXCHANGE_RATES_PERIOD
ARG DISABLE_READ_API=true
ARG API_PATH
ARG NETWORK_PATH
ARG DISABLE_WEBAPP
ARG DISABLE_WRITE_API=true
ARG WOBSERVER_ENABLED
ARG API_V1_READ_METHODS_DISABLED
ARG API_V1_WRITE_METHODS_DISABLED
ARG CACHE_TOTAL_GAS_USAGE_COUNTER_ENABLED
ARG ADMIN_PANEL_ENABLED
ARG CACHE_ADDRESS_WITH_BALANCES_UPDATE_INTERVAL
ARG SESSION_COOKIE_DOMAIN
ARG MIXPANEL_TOKEN
ARG MIXPANEL_URL
ARG AMPLITUDE_API_KEY
ARG AMPLITUDE_URL

# Cache elixir deps
ADD mix.exs mix.lock ./
ADD apps/block_scout_web/mix.exs ./apps/block_scout_web/
ADD apps/explorer/mix.exs ./apps/explorer/
ADD apps/ethereum_jsonrpc/mix.exs ./apps/ethereum_jsonrpc/
ADD apps/indexer/mix.exs ./apps/indexer/

ENV MIX_ENV="prod"
ENV MIX_HOME=/opt/mix
RUN ls _build
RUN mix local.hex --force
RUN mix do deps.get, local.rebar --force, deps.compile --skip-umbrella-children

ADD apps ./apps
ADD config ./config
ADD rel ./rel
ADD *.exs ./
ADD init ./init

RUN apk add nodejs npm

# Run forderground build and phoenix digest
RUN mix compile

# Add blockscout npm deps
RUN cd apps/block_scout_web/assets/ && \
    npm install && \
    npm run deploy && \
    cd -

# Arbitrum: prepare arbitrary abi-installation
RUN cd init/ && \
    npm install && \
    cd -

RUN cd /app/apps/explorer/ && \
    npm install && \
    apk update && \
    apk --update del --force-broken-world alpine-sdk gmp-dev automake libtool inotify-tools autoconf python3 \
    || echo failed removing apks

RUN apk add --update git make

RUN export "CFLAGS=-I/usr/local/include -L/usr/local/lib" && cd deps/ex_secp256k1 && mix deps.get && mix compile
RUN mix phx.digest

RUN mkdir -p /opt/release \
    && mix release blockscout \
    && mv _build/${MIX_ENV}/rel/blockscout /opt/release

##############################################################
FROM hexpm/elixir:1.14.5-erlang-25.3.2.4-alpine-3.18.2

ARG RELEASE_VERSION
ENV RELEASE_VERSION=5.2.2
ARG BLOCKSCOUT_VERSION
ENV BLOCKSCOUT_VERSION=5.2.2

RUN apk --no-cache --update add jq

WORKDIR /app

RUN apk add nodejs npm

COPY --from=builder /opt/release/blockscout .
COPY --from=builder /app/apps/explorer/node_modules ./node_modules

# arbitrum: copy the init script
COPY --from=builder /app/init ./init
COPY --from=builder /app/config/config_helper.exs ./config/config_helper.exs
COPY --from=builder /app/config/config_helper.exs /app/releases/${RELEASE_VERSION}/config_helper.exs
