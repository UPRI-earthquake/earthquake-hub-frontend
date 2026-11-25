
# Stage 1: Build the React application
FROM node:22-alpine AS builder


ARG VITE_APP_ENV
ARG VITE_APP_BACKEND
ARG VITE_APP_RINGSERVER_WS
ARG VITE_APP_FDSNWS
ARG VITE_APP_RS_FDSNWS
ARG VITE_APP_PUBLIC_VAPID_KEY

ENV VITE_APP_ENV=${VITE_APP_ENV}
ENV VITE_APP_BACKEND=${VITE_APP_BACKEND}
ENV VITE_APP_RINGSERVER_WS=${VITE_APP_RINGSERVER_WS}
ENV VITE_APP_FDSNWS=${VITE_APP_FDSNWS}
ENV VITE_APP_RS_FDSNWS=${VITE_APP_RS_FDSNWS}
ENV VITE_APP_PUBLIC_VAPID_KEY=${VITE_APP_PUBLIC_VAPID_KEY}

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

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]


LABEL org.opencontainers.image.source="https://github.com/UPRI-earthquake/earthquake-hub-frontend"
LABEL org.opencontainers.image.description="Base docker image for EarthquakeHub frontend"
LABEL org.opencontainers.image.authors="earthquake@science.upd.edu.ph"
