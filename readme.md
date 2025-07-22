✅ 📂 Estrutura do projeto
Você deve ter os arquivos:

pgsql
Copiar
Editar
meu-bot/
 ├─ index.js
 ├─ package.json
 ├─ contatos.json
 ├─ Dockerfile
 ├─ auth_download.sh
 ├─ .env (opcional)
✅ 📌 Pré-requisitos
1️⃣ Conta no Google Cloud (free tier OK)
2️⃣ gcloud CLI instalado
3️⃣ gsutil (vem junto com gcloud)
4️⃣ Ter Docker instalado na máquina local

✅ 1️⃣ Primeira execução local
Antes de subir pra nuvem, teste tudo local:

bash
Copiar
Editar
npm install
node index.js
O bot vai abrir o QR Code no terminal.

Escaneie com seu WhatsApp.

Confirme se envia para os contatos do contatos.json.

Quando funcionar, vai gerar a pasta auth_info_baileys/.

✅ 2️⃣ Subir sessão para Cloud Storage
1️⃣ Crie um bucket:

bash
Copiar
Editar
gsutil mb gs://SEU_BUCKET
2️⃣ Suba a pasta auth_info_baileys:

bash
Copiar
Editar
gsutil -m cp -r ./auth_info_baileys gs://SEU_BUCKET/
✅ 3️⃣ Ajuste o auth_download.sh
Edite SEU_BUCKET no auth_download.sh:

bash
Copiar
Editar
gsutil -m cp -r gs://SEU_BUCKET/auth_info_baileys ./auth_info_baileys
✅ 4️⃣ Build do container
No diretório do projeto:

bash
Copiar
Editar
docker build -t meu-bot-bom-dia .
Teste local (opcional):

bash
Copiar
Editar
docker run -p 8080:8080 meu-bot-bom-dia
✅ 5️⃣ Deploy no Cloud Run
1️⃣ Autentique:

bash
Copiar
Editar
gcloud auth login
gcloud config set project SEU_PROJECT_ID
2️⃣ Build + push no Artifact Registry (ou direto):

bash
Copiar
Editar
gcloud builds submit --tag gcr.io/SEU_PROJECT_ID/meu-bot-bom-dia
3️⃣ Deploy:

bash
Copiar
Editar
gcloud run deploy meu-bot-bom-dia \
  --image gcr.io/SEU_PROJECT_ID/meu-bot-bom-dia \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
No final, o Google te dá uma URL HTTPS, ex.:

arduino
Copiar
Editar
https://meu-bot-bom-dia-abc123-uc.a.run.app
✅ 6️⃣ Crie o cron job (Cloud Scheduler)
1️⃣ Ative a API:

bash
Copiar
Editar
gcloud services enable cloudscheduler.googleapis.com
2️⃣ Crie o job:

bash
Copiar
Editar
gcloud scheduler jobs create http envia-bom-dia \
  --schedule "0 8 * * *" \
  --http-method POST \
  --uri "https://meu-bot-bom-dia-abc123-uc.a.run.app/send-bom-dia" \
  --time-zone "America/Sao_Paulo"
✅ 7️⃣ Pronto!
📅 Todo dia às 08:00 AM, o Cloud Scheduler chama seu endpoint, o Cloud Run acorda:

Baixa a sessão,

Conecta,

Manda bom dia,

Salva de volta a sessão,

Encerra.

⚡️ Dicas
Primeiro deploy: sempre teste manual. Visite a URL do Cloud Run no navegador ou faça um curl:

bash
Copiar
Editar
curl -X POST https://SEU_CLOUDRUN/send-bom-dia
Se der erro de sessão: verifique o bucket (auth_info_baileys).

Se pedir QR de novo: rode local, escaneie, suba de novo a pasta.

