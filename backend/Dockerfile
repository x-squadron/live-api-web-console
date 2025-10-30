# syntax=docker/dockerfile:1

# Lightweight Node runtime
FROM node:20-alpine AS runtime

WORKDIR /app

# Install curl for healthchecks
RUN apk add --no-cache curl

# Set production mode by default
ENV NODE_ENV=production

# Install dependencies with a clean, reproducible install
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Create a non-root user and ensure permissions
RUN addgroup -S app && adduser -S app -G app \
  && mkdir -p /app/logs \
  #&& chown -R app:app /app

  #USER app

  # Default port (can be overridden by PORT env)
  EXPOSE 3001

# Simple healthcheck hitting Express health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD \
  curl -sf http://localhost:${PORT:-3001}/health || exit 1

# Start server
CMD ["node", "server.js"]


