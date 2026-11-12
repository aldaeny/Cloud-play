# Monorepo build; this image has not been tested in Docker in this environment.
FROM node:22-alpine
ARG CLOUDPLAY_RELEASE
LABEL org.opencontainers.image.revision=$CLOUDPLAY_RELEASE
WORKDIR /app
COPY . .
RUN npm ci && npm run build -w apps/admin && npm prune --omit=dev --ignore-scripts --no-audit --no-fund
RUN sh infra/docker/strip-package-managers.sh
ENV NODE_ENV=production
EXPOSE 3002
CMD ["node", "node_modules/next/dist/bin/next", "start", "apps/admin", "-p", "3002", "--hostname", "0.0.0.0"]
