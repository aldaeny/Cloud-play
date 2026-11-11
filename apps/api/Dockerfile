FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY . .
# A production image must never silently ship the offline types-only client.
RUN npm ci && PRISMA_REQUIRE_NATIVE=1 npm run build -w apps/api
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
