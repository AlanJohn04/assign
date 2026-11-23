# Production Multi-Stage Dockerfile for Frontdesk
FROM node:22-alpine AS builder

WORKDIR /app

# Build Frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Setup Backend
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend/ ./backend/
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

CMD ["node", "backend/src/server.js"]
