FROM node:20-alpine AS builder
WORKDIR /app

ARG REACT_APP_ICE_SERVERS
ENV REACT_APP_ICE_SERVERS=${REACT_APP_ICE_SERVERS}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
