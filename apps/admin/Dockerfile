# Monorepo build; this image has not been tested in Docker in this environment.
FROM node:22-alpine
ARG CLOUDPLAY_RELEASE
LABEL org.opencontainers.image.revision=$CLOUDPLAY_RELEASE
WORKDIR /app
COPY . .
RUN npm ci && npm run build -w apps/admin && npm prune --omit=dev --ignore-scripts --no-audit --no-fund
ENV NODE_ENV=production
EXPOSE 3002
CMD ["npm", "start", "-w", "apps/admin"]
