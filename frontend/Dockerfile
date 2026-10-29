FROM node:18-alpine
WORKDIR /app
ENV HOST 0.0.0.0
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
