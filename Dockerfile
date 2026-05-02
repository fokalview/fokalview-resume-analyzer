FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV API_PORT=8787
COPY --from=build /app/dist ./dist
COPY server ./server
COPY package.json ./
EXPOSE 8787
CMD ["node", "server/analyze.mjs"]
