# Use Node.js 20 Alpine (versão mais recente e leve)
FROM node:20-alpine

# Instala dependências do sistema necessárias para o Baileys
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Define variáveis de ambiente para o Puppeteer/Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

# Define o diretório de trabalho
WORKDIR /app

# Copia arquivos de dependências primeiro (cache otimizado)
COPY package*.json ./

# Instala dependências
RUN npm ci --only=production && npm cache clean --force

# Copia o código da aplicação
COPY . .

# Cria diretório para sessões do WhatsApp
RUN mkdir -p auth_info_baileys && chmod 755 auth_info_baileys

# Expõe a porta
EXPOSE 8080

# Comando para iniciar a aplicação
CMD ["node", "server.js"]