# Monorepo build; this image has not been tested in Docker in this environment.
FROM node:20-alpine
ARG CLOUDPLAY_RELEASE
LABEL org.opencontainers.image.revision=$CLOUDPLAY_RELEASE
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm ci && npm run build -w apps/web
ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm", "start", "-w", "apps/web"]
