ARG NODE_IMAGE=node:24-bookworm-slim
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY frontend/ ./frontend/
COPY avatars.js reactions.js surveys.js ./
RUN npm run build

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY package.json server.js avatars.js reactions.js surveys.js ./
COPY public/ ./public/
COPY --from=build /app/dist/app.js ./dist/app.js
RUN install -d -m 0700 -o node -g node /app/data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
