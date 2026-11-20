
# Stage 1: Build the React application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source
COPY . .

# Build production application
RUN npm run build


# Stage 2: Serve with Nginx
FROM nginx:alpine AS production

# Remove default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Add custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production build
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]


LABEL org.opencontainers.image.source="https://github.com/UPRI-earthquake/earthquake-hub-frontend"
LABEL org.opencontainers.image.description="Base docker image for EarthquakeHub frontend"
LABEL org.opencontainers.image.authors="earthquake@science.upd.edu.ph"
