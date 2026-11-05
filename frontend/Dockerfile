FROM node:22-alpine AS development
ARG FRONTEND_INTERNAL_PORT
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE ${FRONTEND_INTERNAL_PORT}
CMD ["sh", "-c", "npm run dev -- --hostname ${FRONTEND_HOST}"]
