FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY . .
RUN npx next build --webpack

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3050
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/edge ./edge
EXPOSE 3050
RUN mkdir -p /app/data && chown node:node /app/data
ARG APP_COMMIT=""
ARG APP_BUILD_DATE=""
ENV APP_COMMIT=$APP_COMMIT APP_BUILD_DATE=$APP_BUILD_DATE
USER node
CMD ["node", "server.js"]
