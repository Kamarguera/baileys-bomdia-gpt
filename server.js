const express = require('express');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Configurar Google Cloud Storage
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME || 'whatsapp-bot-sessions'; // Você precisa criar este bucket
const bucket = storage.bucket(bucketName);

// Middleware
app.use(express.json());
app.use(express.static('public'));

let globalSocket = null;
let isConnected = false;
let qrCodeData = null;

// Função para baixar sessão do Google Cloud Storage
async function downloadAuthFromGCS() {
  const authDir = path.join(__dirname, 'auth_info_baileys');

  try {
    // Criar diretório local se não existir
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    console.log('📥 Baixando sessão do Google Cloud Storage...');

    // Listar arquivos de auth no bucket
    const [files] = await bucket.getFiles({ prefix: 'auth_info_baileys/' });

    if (files.length === 0) {
      console.log('ℹ️ Nenhuma sessão encontrada no storage.');
      return false;
    }

    // Baixar cada arquivo
    for (const file of files) {
      const fileName = file.name.replace('auth_info_baileys/', '');
      if (fileName) {
        const localFilePath = path.join(authDir, fileName);
        await file.download({ destination: localFilePath });
        console.log(`✅ Baixado: ${fileName}`);
      }
    }

    console.log('✅ Sessão restaurada do Google Cloud Storage!');
    return true;
  } catch (error) {
    console.log('⚠️ Erro ao baixar sessão:', error.message);
    return false;
  }
}

// Função para fazer upload da sessão para Google Cloud Storage
async function uploadAuthToGCS() {
  const authDir = path.join(__dirname, 'auth_info_baileys');

  try {
    if (!fs.existsSync(authDir)) {
      return;
    }

    console.log('📤 Salvando sessão no Google Cloud Storage...');

    const files = fs.readdirSync(authDir);

    for (const fileName of files) {
      const localFilePath = path.join(authDir, fileName);
      const cloudFileName = `auth_info_baileys/${fileName}`;

      if (fs.statSync(localFilePath).isFile()) {
        await bucket.upload(localFilePath, {
          destination: cloudFileName,
          metadata: {
            cacheControl: 'no-cache',
          },
        });
        console.log(`✅ Uploaded: ${fileName}`);
      }
    }

    console.log('✅ Sessão salva no Google Cloud Storage!');
  } catch (error) {
    console.error('❌ Erro ao fazer upload da sessão:', error.message);
  }
}

// Função personalizada para salvar credenciais
function createPersistentAuthState(authDir) {
  return {
    state: {
      creds: null,
      keys: null
    },
    saveCreds: async () => {
      // Salvar localmente primeiro
      const credsPath = path.join(authDir, 'creds.json');
      if (fs.existsSync(credsPath)) {
        // Fazer upload para Google Cloud Storage toda vez que as credenciais mudarem
        await uploadAuthToGCS();
      }
    }
  };
}

async function createSocket() {
  const authDir = path.join(__dirname, 'auth_info_baileys');

  // Criar diretório de auth se não existir
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Tentar baixar sessão existente do Google Cloud Storage
  await downloadAuthFromGCS();

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const socket = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false,
    browser: ['Bot Bom Dia', 'Chrome', '1.0.0']
  });

  // Handler de conexão
  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📱 QR Code gerado');
      qrCodeData = await qrcode.toDataURL(qr);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      console.log('Conexão fechada. Reconectar?', shouldReconnect);

      isConnected = false;

      if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
        // Se foi deslogado, limpar sessão do storage
        try {
          const [files] = await bucket.getFiles({ prefix: 'auth_info_baileys/' });
          await Promise.all(files.map(file => file.delete()));
          console.log('🗑️ Sessão removida do storage (logout)');
        } catch (error) {
          console.error('Erro ao limpar sessão:', error.message);
        }
      }

      if (shouldReconnect) {
        setTimeout(() => createSocket(), 5000); // Aumentei o delay
      }
    } else if (connection === 'open') {
      console.log('✅ Bot conectado!');
      isConnected = true;
      qrCodeData = null;

      // Salvar sessão no storage após conexão bem-sucedida
      await uploadAuthToGCS();
    }
  });

  // Modificar o handler de credenciais para fazer upload automático
  socket.ev.on('creds.update', async () => {
    await saveCreds();
    // Fazer upload toda vez que as credenciais mudarem
    await uploadAuthToGCS();
  });

  return socket;
}

// Página para mostrar QR Code (mesmo código anterior)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>WhatsApp Bot</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial; text-align: center; padding: 20px; }
            .qr-container { margin: 20px 0; }
            .status { padding: 10px; margin: 10px; border-radius: 5px; }
            .connected { background-color: #d4edda; color: #155724; }
            .disconnected { background-color: #f8d7da; color: #721c24; }
            .waiting { background-color: #fff3cd; color: #856404; }
            button { padding: 10px 20px; margin: 10px; font-size: 16px; }
        </style>
    </head>
    <body>
        <h1>🤖 WhatsApp Bot de Bom Dia</h1>
        <div id="status" class="status waiting">Aguardando conexão...</div>
        <div class="qr-container">
            <div id="qr-code"></div>
        </div>
        <button onclick="initializeBot()">Inicializar Bot</button>
        <button onclick="sendBomDia()" id="sendBtn" disabled>Enviar Bom Dia</button>
        <button onclick="checkStatus()">Verificar Status</button>
        
        <div id="logs" style="text-align: left; margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
            <h3>Logs:</h3>
            <div id="logContent"></div>
        </div>

        <script>
            function addLog(message) {
                const logContent = document.getElementById('logContent');
                const time = new Date().toLocaleTimeString();
                logContent.innerHTML += '<div>' + time + ': ' + message + '</div>';
                logContent.scrollTop = logContent.scrollHeight;
            }

            function updateStatus(status, message) {
                const statusDiv = document.getElementById('status');
                statusDiv.className = 'status ' + status;
                statusDiv.textContent = message;
                
                const sendBtn = document.getElementById('sendBtn');
                sendBtn.disabled = status !== 'connected';
            }

            async function initializeBot() {
                try {
                    addLog('Inicializando bot...');
                    const response = await fetch('/initialize', { method: 'POST' });
                    const result = await response.json();
                    addLog(result.message);
                    
                    if (result.qr) {
                        document.getElementById('qr-code').innerHTML = '<img src="' + result.qr + '" alt="QR Code">';
                        updateStatus('waiting', 'Escaneie o QR Code com WhatsApp');
                        startStatusCheck();
                    }
                } catch (error) {
                    addLog('Erro: ' + error.message);
                }
            }

            async function sendBomDia() {
                try {
                    addLog('Enviando mensagens de bom dia...');
                    const response = await fetch('/send-bom-dia', { method: 'POST' });
                    const result = await response.json();
                    addLog(result.message);
                } catch (error) {
                    addLog('Erro: ' + error.message);
                }
            }

            async function checkStatus() {
                try {
                    const response = await fetch('/status');
                    const result = await response.json();
                    updateStatus(result.connected ? 'connected' : 'disconnected', result.message);
                    addLog('Status: ' + result.message);
                } catch (error) {
                    addLog('Erro ao verificar status: ' + error.message);
                }
            }

            function startStatusCheck() {
                const interval = setInterval(async () => {
                    const response = await fetch('/status');
                    const result = await response.json();
                    
                    if (result.connected) {
                        updateStatus('connected', 'Bot conectado e pronto!');
                        document.getElementById('qr-code').innerHTML = '<p>✅ Conectado com sucesso!</p>';
                        addLog('Bot conectado com sucesso!');
                        clearInterval(interval);
                    }
                }, 2000);
            }

            window.onload = () => {
                checkStatus();
            };
        </script>
    </body>
    </html>
  `);
});

// Resto dos endpoints (mesmo código anterior)
app.post('/initialize', async (req, res) => {
  try {
    console.log('🚀 Inicializando bot...');

    if (globalSocket) {
      globalSocket.end();
    }

    globalSocket = await createSocket();

    await new Promise(resolve => setTimeout(resolve, 2000));

    if (qrCodeData) {
      res.json({
        success: true,
        message: 'Bot inicializado. Escaneie o QR Code.',
        qr: qrCodeData
      });
    } else if (isConnected) {
      res.json({
        success: true,
        message: 'Bot já está conectado!',
        connected: true
      });
    } else {
      res.json({
        success: false,
        message: 'Erro ao gerar QR Code. Tente novamente.'
      });
    }
  } catch (error) {
    console.error('Erro ao inicializar:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno: ' + error.message
    });
  }
});

app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    message: isConnected ? 'Bot conectado e pronto!' : 'Bot desconectado',
    hasQR: !!qrCodeData
  });
});

async function enviarBomDia(socket) {
  try {
    if (!fs.existsSync('contatos.json')) {
      console.log('⚠️ Criando arquivo contatos.json exemplo...');
      const exemploContatos = {
        contatos: [
          "5511999999999@s.whatsapp.net",
        ]
      };
      fs.writeFileSync('contatos.json', JSON.stringify(exemploContatos, null, 2));
      throw new Error('Arquivo contatos.json criado. Adicione os números e tente novamente.');
    }

    const config = JSON.parse(fs.readFileSync('contatos.json', 'utf8'));
    const contatos = config.contatos || [];

    if (contatos.length === 0) {
      throw new Error('Nenhum contato encontrado no arquivo contatos.json');
    }

    const mensagens = [
      '🌅 Bom dia! Que seu dia seja incrível!',
      '☀️ Bom dia! Te desejo um dia maravilhoso!',
      '🌞 Bom dia! Que hoje seja um dia especial!',
      '✨ Bom dia! Enviando energia positiva para você!'
    ];

    const mensagem = mensagens[Math.floor(Math.random() * mensagens.length)];
    let sucessos = 0;
    let erros = 0;

    console.log(`📤 Enviando para ${contatos.length} contatos...`);

    for (const contato of contatos) {
      try {
        await socket.sendMessage(contato, { text: mensagem });
        console.log(`✅ Mensagem enviada para: ${contato}`);
        sucessos++;

        const delay = 2000 + Math.random() * 3000;
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (err) {
        console.error(`❌ Erro ao enviar para ${contato}:`, err.message);
        erros++;
      }
    }

    return {
      total: contatos.length,
      sucessos,
      erros,
      mensagem
    };

  } catch (error) {
    console.error('Erro geral no envio:', error);
    throw error;
  }
}

app.post('/send-bom-dia', async (req, res) => {
  try {
    if (!isConnected || !globalSocket) {
      return res.status(400).json({
        success: false,
        message: 'Bot não está conectado. Inicialize primeiro.'
      });
    }

    console.log('📨 Iniciando envio de bom dia...');
    const resultado = await enviarBomDia(globalSocket);

    res.json({
      success: true,
      message: `✅ Envio concluído! ${resultado.sucessos}/${resultado.total} mensagens enviadas com sucesso.`,
      detalhes: resultado
    });

  } catch (error) {
    console.error('Erro no endpoint send-bom-dia:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar mensagens: ' + error.message
    });
  }
});

app.post('/disconnect', async (req, res) => {
  try {
    if (globalSocket) {
      globalSocket.logout();
      globalSocket.end();
      globalSocket = null;
    }
    isConnected = false;
    qrCodeData = null;

    // Limpar sessão do storage
    try {
      const [files] = await bucket.getFiles({ prefix: 'auth_info_baileys/' });
      await Promise.all(files.map(file => file.delete()));
      console.log('🗑️ Sessão removida do storage');
    } catch (error) {
      console.error('Erro ao limpar sessão:', error.message);
    }

    res.json({
      success: true,
      message: 'Bot desconectado com sucesso!'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao desconectar: ' + error.message
    });
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Acesse: http://localhost:${PORT}`);

  // Tentar conectar automaticamente se já tem credenciais salvas
  console.log('🔄 Tentando reconectar automaticamente...');
  try {
    globalSocket = await createSocket();
  } catch (error) {
    console.log('⚠️ Falha na reconexão automática:', error.message);
  }
});

process.on('SIGINT', () => {
  console.log('🔄 Encerrando bot...');
  if (globalSocket) {
    globalSocket.end();
  }
  process.exit(0);
});