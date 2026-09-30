# O contexto deste build e a pasta backend (Root Directory no Render).
# O package-lock.json fica na raiz do monorepo e nao entra nesse contexto,
# entao o install usa npm install em vez de npm ci.
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

COPY package.json ./
COPY prisma ./prisma/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN mkdir -p /var/data/whatsapp_sessions \
  && chown -R node:node /var/data/whatsapp_sessions /app

USER node

EXPOSE 10000

# Cria as tabelas no Postgres vazio. Nao usa --accept-data-loss nem o seed
# que regrava senha de admin a cada boot.
CMD ["sh", "-c", "npx prisma db push && node dist/server.js"]
