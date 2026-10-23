FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# The server has no runtime dependencies: Node runs the TypeScript directly
# and uses its built-in SQLite module.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/fitness.db \
    STATIC_DIR=/app/dist
COPY package.json ./
COPY shared ./shared
COPY server ./server
COPY --from=build /app/dist ./dist
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.ts"]
