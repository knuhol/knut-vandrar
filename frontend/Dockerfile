ARG NODE_VERSION
FROM node:${NODE_VERSION}-alpine AS development
ARG FRONTEND_INTERNAL_PORT
WORKDIR /app
COPY .npmrc ./
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
EXPOSE ${FRONTEND_INTERNAL_PORT}
CMD ["sh", "./scripts/docker-entrypoint.sh"]
