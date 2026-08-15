# Imagem de produção do Jornada360.
#
# Duas etapas: a primeira constrói o frontend (precisa das dependências de desenvolvimento), a
# segunda carrega só o que roda. O resultado não leva TypeScript, Vite, testes nem código-fonte do
# frontend — menos superfície para auditar e uma imagem consideravelmente menor.

# ---------------------------------------------------------------- etapa 1: construir
FROM node:24-alpine AS construcao

WORKDIR /app

# Copiar os manifestos primeiro faz o Docker reaproveitar a camada de dependências enquanto o
# package.json não muda — a diferença entre um build de segundos e um de minutos.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public

RUN npm run build

# ---------------------------------------------------------------- etapa 2: executar
FROM node:24-alpine AS producao

# `tini` como PID 1 para que SIGTERM chegue ao Node de verdade. Sem isso, `docker stop` espera o
# tempo limite e mata à força — no meio de uma escrita no banco, na pior das hipóteses.
RUN apk add --no-cache tini

ENV NODE_ENV=production
WORKDIR /app

# Só as dependências de runtime (express, cors, nodemailer).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY scripts ./scripts
COPY --from=construcao /app/dist ./dist

# O banco e os backups vivem em volumes, FORA da imagem. É o que faz um deploy novo não apagar os
# dados — o erro mais caro e mais silencioso que este projeto pode cometer.
RUN mkdir -p /dados /backups && chown -R node:node /dados /backups /app

# Rodar como `node`, não como root: se algo escapar do processo, escapa sem privilégio.
USER node

ENV JORNADA_PORT=3333 \
    JORNADA_DB_PATH=/dados/jornada360.db \
    JORNADA_BACKUP_DIR=/backups \
    JORNADA_SERVIR_FRONTEND=1

EXPOSE 3333

# O healthcheck usa a rota rápida (`/api/saude`), que não toca o banco: uma lentidão momentânea de
# disco não deve derrubar um processo saudável. A checagem profunda é `/api/prontidao`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.JORNADA_PORT||3333)+'/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/index.js"]
