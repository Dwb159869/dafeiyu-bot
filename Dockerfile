FROM node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
ARG APP_UID=1000
ARG APP_GID=1000
ENV DEBIAN_FRONTEND=noninteractive PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN apt-get update && apt-get install -y --no-install-recommends bash ca-certificates curl git python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/template
COPY profile/package*.json ./
COPY vendor ./vendor
COPY plugins ./plugins
RUN npm ci --install-links --no-audit --no-fund
COPY app/patch-companion.mjs /opt/app/patch-companion.mjs
RUN node /opt/app/patch-companion.mjs /opt/template/node_modules/dsh-companion-core/lib \
    && node node_modules/playwright/cli.js install --with-deps chromium \
    && node -e "console.log(require('playwright').chromium.executablePath())" > /opt/template/chromium-path
RUN if [ "$(id -u node)" != "$APP_UID" ]; then usermod -u "$APP_UID" node; fi \
    && if getent group "$APP_GID" >/dev/null; then usermod -g "$APP_GID" node; else groupmod -g "$APP_GID" node; fi
COPY app /opt/app
COPY app/persona.md /opt/template/persona.md
RUN chmod +x /opt/app/entrypoint.sh && chmod -R a+rX /opt/template /opt/app /ms-playwright
ENV DSH_HOME=/data/dsh HOME=/data/dsh USER=node TZ=Asia/Shanghai
USER node
WORKDIR /workspace/vault
ENTRYPOINT ["/opt/app/entrypoint.sh"]
