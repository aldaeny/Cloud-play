# Monorepo build; this image has not been tested in Docker in this environment.
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build -w apps/web
ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm", "start", "-w", "apps/web"]
