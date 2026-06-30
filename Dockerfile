FROM node:20-alpine

WORKDIR /app

# Instalar dependências do OpenSSL para Prisma
RUN apk add --no-cache openssl1.1-compat

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

EXPOSE 3000

ENV NODE_ENV production
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "start"]
