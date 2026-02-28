# Stage 1: Build the Application
FROM node:20-slim AS build

WORKDIR /usr/src/app

# Copy package files first to leverage caching
COPY package*.json ./

# Install dependencies (ignore peer conflicts)
RUN npm install --legacy-peer-deps

# Copy application source code
COPY . .

# Stage 2: Production Image
FROM node:20-slim

WORKDIR /usr/src/app

# Copy node_modules and app files from build stage
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app ./

# Set port and expose
ENV PORT=8080
EXPOSE $PORT

# Use non-root user
USER node

# Start application
CMD [ "node", "index.js" ]