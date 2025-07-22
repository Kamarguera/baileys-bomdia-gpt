#!/bin/bash

# Baixa sessão do Cloud Storage
echo "📥 Baixando auth_info_baileys do bucket..."
gsutil -m cp -r gs://SEU_BUCKET/auth_info_baileys ./auth_info_baileys

# Inicia o Node
echo "🚀 Iniciando bot..."
node index.js

# Depois de rodar, salva de volta a sessão
echo "📤 Subindo auth_info_baileys atualizado..."
gsutil -m cp -r ./auth_info_baileys gs://SEU_BUCKET/auth_info_baileys
