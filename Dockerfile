# build environment
FROM node:14-alpine as build

LABEL version="1.0"
LABEL description="Base docker image for LatestEarthquakesPH front-end"
LABEL maintainer=["cpsanchez@science.upd.edu.ph"]

WORKDIR /app
ENV PATH /app/node-modules/.bin:$PATH
COPY package.json ./
COPY package-lock.json ./
RUN npm ci 
RUN npm install react-scripts@4.0.3 -g
COPY . ./

RUN npm run build

# production environment
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 443
CMD ["nginx", "-g", "daemon off;"]



