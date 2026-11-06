# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

FROM nginx:1.27-alpine
# The official image fills ${API_UPSTREAM} into this template when the container starts.
ENV API_UPSTREAM=api:8080
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist/web/browser /usr/share/nginx/html
EXPOSE 8080 8081
