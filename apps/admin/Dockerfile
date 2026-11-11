# Monorepo build; this image has not been tested in Docker in this environment.
FROM node:20-alpine
ARG CLOUDPLAY_RELEASE
LABEL org.opencontainers.image.revision=$CLOUDPLAY_RELEASE
WORKDIR /app
COPY . .
RUN npm ci && npm run build -w apps/admin
ENV NODE_ENV=production
EXPOSE 3002
CMD ["npm", "start", "-w", "apps/admin"]
