# Multi-stage Dockerfile for ClarityDental DCMS
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci || npm install

# Copy source files
COPY . .

# Build frontend production bundle
RUN npm run build

# --- Production Runner Stage ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules and built frontend from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/tsconfig.json ./

# Create data directory for SQLite database persistence
RUN mkdir -p data

EXPOSE 3000

CMD ["npm", "start"]
