FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install -g @angular/cli@16 && npm install
COPY . .
RUN ng build --configuration production

FROM nginx:alpine
COPY --from=build /app/dist/user-management /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
