# build environment
FROM node:16-alpine as base

EXPOSE 3000

WORKDIR /app

# Stage 2: prod
FROM base as build

ENV PATH /app/node-modules/.bin:$PATH
COPY package.json ./
COPY package-lock.json ./
RUN npm ci
RUN npm install react-scripts@4.0.3 -g

# copy source except config
COPY ./src ./src
COPY ./public ./public
RUN [ -f ./public/config.js ] && rm ./public/config.js || echo "config.js not found, skipping removal."

# get minified static build
RUN npm run build

# production environment, use nginx as static server
FROM nginx:stable-alpine

EXPOSE 3000
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
COPY ./import-env.sh /import-env.sh
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /import-env.sh
RUN chmod +x /entrypoint.sh

# import env vars from environment
ENTRYPOINT ["./entrypoint.sh"]

# run nginx server (serves as args to ENTRYPOINT)
CMD ["nginx", "-g", "daemon off;"]

LABEL org.opencontainers.image.source="https://github.com/UPRI-earthquake/earthquake-hub-frontend"
LABEL org.opencontainers.image.description="Base docker image for EarthquakeHub frontend"
LABEL org.opencontainers.image.authors="earthquake@science.upd.edu.ph"

