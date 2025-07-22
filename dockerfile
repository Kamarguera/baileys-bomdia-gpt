# Imagem base
FROM node:20

# Diretório de trabalho
WORKDIR /usr/src/app

# Copiar arquivos
COPY package*.json ./
COPY index.js ./
COPY contatos.json ./

# Instalar dependências
RUN npm install

# Copiar script de auth
COPY auth_download.sh ./
RUN chmod +x auth_download.sh

# Entrypoint: baixa sessão antes de iniciar
ENTRYPOINT ["./auth_download.sh"]

# Expõe a porta padrão do Express
EXPOSE 8080
