# Local development container only. Production uses Cloudflare Pages.
FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 8788
CMD ["sh", "-c", "npm run db:migrate && npm run dev:api -- --ip 0.0.0.0"]
