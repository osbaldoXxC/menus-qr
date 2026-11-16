FROM node:22.23.5-alpine

WORKDIR /app

COPY package*.json ./

# Optimizar instalación usando npm ci y Estándar de Node 18 para reuso de capas base
RUN npm ci --quiet

COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev", "--", "--host", "--port", "3001"]
