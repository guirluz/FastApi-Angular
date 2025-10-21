FROM node:18

WORKDIR /app

# Copia archivos de dependencias
COPY package*.json ./

# Instala Angular CLI y dependencias
RUN npm install -g @angular/cli@16 && npm install

# Copia todo el código fuente
COPY . .

# Expone el puerto 4200
EXPOSE 4200

# Comando para ejecutar Angular en modo desarrollo
CMD ["ng", "serve", "--host", "0.0.0.0", "--port", "4200", "--poll", "2000"]
