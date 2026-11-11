FROM node:20-alpine AS builder
ARG CLOUDPLAY_RELEASE
LABEL org.opencontainers.image.revision=$CLOUDPLAY_RELEASE
WORKDIR /app
RUN apk add --no-cache ffmpeg openssl
COPY . .
RUN npm ci && npm run prisma:generate -w apps/api && npm run build -w apps/worker-media
ENV NODE_ENV=production
EXPOSE 3004
CMD ["node", "apps/worker-media/dist/worker.js"]
