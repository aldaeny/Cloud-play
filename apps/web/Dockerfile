# Monorepo build; this image has not been tested in Docker in this environment.
FROM node:22-alpine
ARG CLOUDPLAY_RELEASE
LABEL org.opencontainers.image.revision=$CLOUDPLAY_RELEASE
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm ci && npm run build -w apps/web && npm prune --omit=dev --ignore-scripts --no-audit --no-fund
RUN sh infra/docker/strip-package-managers.sh
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "node_modules/next/dist/bin/next", "start", "apps/web", "-p", "3001", "--hostname", "0.0.0.0"]
