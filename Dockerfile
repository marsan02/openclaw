# Build stage for React frontend
FROM node:20-alpine AS builder

WORKDIR /app/marketplace

# Install frontend dependencies
COPY apps/marketplace/package*.json ./
RUN npm install

# Copy frontend source and build
COPY apps/marketplace/ ./
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy server package and install
COPY package.json ./
RUN npm install --only=production --ignore-scripts

# Copy server code
COPY server ./server
COPY registry.json ./

# Copy app backends
COPY apps/hello-world/server ./apps/hello-world/server
COPY apps/mortgage-simulator/server ./apps/mortgage-simulator/server
COPY apps/shopping-list/server ./apps/shopping-list/server
COPY apps/task-manager/server ./apps/task-manager/server

# Copy built frontend from builder
COPY --from=builder /app/marketplace/dist ./apps/marketplace/dist

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
