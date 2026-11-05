ARG NODE_VERSION
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
COPY .npmrc ./
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .

FROM base AS development
ARG FRONTEND_INTERNAL_PORT
EXPOSE ${FRONTEND_INTERNAL_PORT}
CMD ["sh", "./scripts/docker-entrypoint.sh"]

FROM base AS production
ARG FRONTEND_INTERNAL_PORT
ARG FRONTEND_HOST
ARG NEXT_PUBLIC_API_URL
ENV FRONTEND_HOST=${FRONTEND_HOST} NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build
EXPOSE ${FRONTEND_INTERNAL_PORT}
CMD ["sh", "-c", "npm run start -- --hostname \"$FRONTEND_HOST\""]
