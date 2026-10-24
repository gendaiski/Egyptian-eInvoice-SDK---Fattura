FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY db.mjs security.mjs server.mjs ./
COPY web ./web
COPY public ./public
RUN mkdir -p /app/data && chown node:node /app/data
ENV NODE_ENV=production MA_HOST=0.0.0.0 MA_PORT=8797 MA_DATA_DIR=/app/data
EXPOSE 8797
VOLUME /app/data
USER node
CMD ["node", "server.mjs"]
