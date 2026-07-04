FROM node:24-alpine AS ui-builder 
WORKDIR /app
COPY package*.json ./
COPY .npmrc .npmrc
RUN npm install
COPY . .
RUN npm run build
FROM nginx:alpine
COPY --from=ui-builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]