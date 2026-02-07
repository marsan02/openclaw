# Build stage for React frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/marketplace/package*.json ./apps/marketplace/

# Install all dependencies (including dev for build)
RUN npm install
RUN cd apps/marketplace && npm install

# Copy source
COPY . .

# Build the React app
RUN cd apps/marketplace && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production deps only
COPY package*.json ./
RUN npm install --only=production

# Copy server code
COPY server ./server
COPY registry.json ./

# Copy app backends
COPY apps/hello-world/server ./apps/hello-world/server

# Copy built frontend from builder
COPY --from=builder /app/apps/marketplace/dist ./apps/marketplace/dist

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
