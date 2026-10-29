FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Optimizar instalación usando npm ci y Estándar de Node 18 para reuso de capas base
RUN npm ci --quiet && \
    npm install --os=linux --libc=musl --cpu=x64 @rolldown/binding-linux-x64-musl --quiet

COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev", "--", "--host", "--port", "3001"]
