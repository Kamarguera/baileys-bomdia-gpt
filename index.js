// const express = require('express');
// const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
// const pino = require('pino');
// const qrcode = require('qrcode');
// const fs = require('fs');
// const path = require('path');
// require('dotenv').config();

// const app = express();
// const PORT = process.env.PORT || 8080;

// // Middleware
// app.use(express.json());
// app.use(express.static('public')); // para servir página do QR

// let globalSocket = null;
// let isConnected = false;
// let qrCodeData = null;

// // Página para mostrar QR Code
// app.get('/', (req, res) => {
//   res.send(`
//     <!DOCTYPE html>
//     <html>
//     <head>
//         <title>WhatsApp Bot</title>
//         <meta charset="utf-8">
//         <style>
//             body { font-family: Arial; text-align: center; padding: 20px; }
//             .qr-container { margin: 20px 0; }
//             .status { padding: 10px; margin: 10px; border-radius: 5px; }
//             .connected { background-color: #d4edda; color: #155724; }
//             .disconnected { background-color: #f8d7da; color: #721c24; }
//             .waiting { background-color: #fff3cd; color: #856404; }
//             button { padding: 10px 20px; margin: 10px; font-size: 16px; }
//         </style>
//     </head>
//     <body>
//         <h1>🤖 WhatsApp Bot de Bom Dia</h1>
//         <div id="status" class="status waiting">Aguardando conexão...</div>
//         <div class="qr-container">
//             <div id="qr-code"></div>
//         </div>
//         <button onclick="initializeBot()">Inicializar Bot</button>
//         <button onclick="sendBomDia()" id="sendBtn" disabled>Enviar Bom Dia</button>
//         <button onclick="checkStatus()">Verificar Status</button>
        
//         <div id="logs" style="text-align: left; margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
//             <h3>Logs:</h3>
//             <div id="logContent"></div>
//         </div>

//         <script>
//             function addLog(message) {
//                 const logContent = document.getElementById('logContent');
//                 const time = new Date().toLocaleTimeString();
//                 logContent.innerHTML += '<div>' + time + ': ' + message + '</div>';
//                 logContent.scrollTop = logContent.scrollHeight;
//             }

//             function updateStatus(status, message) {
//                 const statusDiv = document.getElementById('status');
//                 statusDiv.className = 'status ' + status;
//                 statusDiv.textContent = message;
                
//                 const sendBtn = document.getElementById('sendBtn');
//                 sendBtn.disabled = status !== 'connected';
//             }

//             async function initializeBot() {
//                 try {
//                     addLog('Inicializando bot...');
//                     const response = await fetch('/initialize', { method: 'POST' });
//                     const result = await response.json();
//                     addLog(result.message);
                    
//                     if (result.qr) {
//                         document.getElementById('qr-code').innerHTML = '<img src="' + result.qr + '" alt="QR Code">';
//                         updateStatus('waiting', 'Escaneie o QR Code com WhatsApp');
//                         startStatusCheck();
//                     }
//                 } catch (error) {
//                     addLog('Erro: ' + error.message);
//                 }
//             }

//             async function sendBomDia() {
//                 try {
//                     addLog('Enviando mensagens de bom dia...');
//                     const response = await fetch('/send-bom-dia', { method: 'POST' });
//                     const result = await response.json();
//                     addLog(result.message);
//                 } catch (error) {
//                     addLog('Erro: ' + error.message);
//                 }
//             }

//             async function checkStatus() {
//                 try {
//                     const response = await fetch('/status');
//                     const result = await response.json();
//                     updateStatus(result.connected ? 'connected' : 'disconnected', result.message);
//                     addLog('Status: ' + result.message);
//                 } catch (error) {
//                     addLog('Erro ao verificar status: ' + error.message);
//                 }
//             }

//             function startStatusCheck() {
//                 const interval = setInterval(async () => {
//                     const response = await fetch('/status');
//                     const result = await response.json();
                    
//                     if (result.connected) {
//                         updateStatus('connected', 'Bot conectado e pronto!');
//                         document.getElementById('qr-code').innerHTML = '<p>✅ Conectado com sucesso!</p>';
//                         addLog('Bot conectado com sucesso!');
//                         clearInterval(interval);
//                     }
//                 }, 2000);
//             }

//             // Verificar status ao carregar a página
//             window.onload = () => {
//                 checkStatus();
//             };
//         </script>
//     </body>
//     </html>
//   `);
// });

// async function createSocket() {
//   const authDir = path.join(__dirname, 'auth_info_baileys');

//   // Criar diretório de auth se não existir
//   if (!fs.existsSync(authDir)) {
//     fs.mkdirSync(authDir, { recursive: true });
//   }

//   const { state, saveCreds } = await useMultiFileAuthState(authDir);

//   const socket = makeWASocket({
//     logger: pino({ level: 'silent' }),
//     auth: state,
//     printQRInTerminal: false, // Desabilitar QR no terminal
//     browser: ['Bot Bom Dia', 'Chrome', '1.0.0']
//   });

//   // Handler de conexão
//   socket.ev.on('connection.update', async (update) => {
//     const { connection, lastDisconnect, qr } = update;

//     if (qr) {
//       console.log('📱 QR Code gerado');
//       // Converter QR para base64
//       qrCodeData = await qrcode.toDataURL(qr);
//     }

//     if (connection === 'close') {
//       const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
//       console.log('Conexão fechada. Reconectar?', shouldReconnect);

//       isConnected = false;
//       if (shouldReconnect) {
//         setTimeout(() => createSocket(), 3000);
//       }
//     } else if (connection === 'open') {
//       console.log('✅ Bot conectado!');
//       isConnected = true;
//       qrCodeData = null;
//     }
//   });

//   socket.ev.on('creds.update', saveCreds);

//   return socket;
// }

// // Endpoint para inicializar o bot
// app.post('/initialize', async (req, res) => {
//   try {
//     console.log('🚀 Inicializando bot...');

//     if (globalSocket) {
//       globalSocket.end();
//     }

//     globalSocket = await createSocket();

//     // Aguardar um pouco para gerar QR
//     await new Promise(resolve => setTimeout(resolve, 2000));

//     if (qrCodeData) {
//       res.json({
//         success: true,
//         message: 'Bot inicializado. Escaneie o QR Code.',
//         qr: qrCodeData
//       });
//     } else if (isConnected) {
//       res.json({
//         success: true,
//         message: 'Bot já está conectado!',
//         connected: true
//       });
//     } else {
//       res.json({
//         success: false,
//         message: 'Erro ao gerar QR Code. Tente novamente.'
//       });
//     }
//   } catch (error) {
//     console.error('Erro ao inicializar:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Erro interno: ' + error.message
//     });
//   }
// });

// // Endpoint para verificar status
// app.get('/status', (req, res) => {
//   res.json({
//     connected: isConnected,
//     message: isConnected ? 'Bot conectado e pronto!' : 'Bot desconectado',
//     hasQR: !!qrCodeData
//   });
// });

// async function enviarBomDia(socket) {
//   try {
//     // Verificar se arquivo de contatos existe
//     if (!fs.existsSync('contatos.json')) {
//       console.log('⚠️ Criando arquivo contatos.json exemplo...');
//       const exemploContatos = {
//         contatos: [
//           "5511999999999@s.whatsapp.net", // Formato: DDI + DDD + número + @s.whatsapp.net
//           // Adicione mais contatos aqui
//         ]
//       };
//       fs.writeFileSync('contatos.json', JSON.stringify(exemploContatos, null, 2));
//       throw new Error('Arquivo contatos.json criado. Adicione os números e tente novamente.');
//     }

//     const config = JSON.parse(fs.readFileSync('contatos.json', 'utf8'));
//     const contatos = config.contatos || [];

//     if (contatos.length === 0) {
//       throw new Error('Nenhum contato encontrado no arquivo contatos.json');
//     }

//     const mensagens = [
//       '🌅 Bom dia! Que seu dia seja incrível!',
//       '☀️ Bom dia! Te desejo um dia maravilhoso!',
//       '🌞 Bom dia! Que hoje seja um dia especial!',
//       '✨ Bom dia! Enviando energia positiva para você!'
//     ];

//     const mensagem = mensagens[Math.floor(Math.random() * mensagens.length)];
//     let sucessos = 0;
//     let erros = 0;

//     console.log(`📤 Enviando para ${contatos.length} contatos...`);

//     for (const contato of contatos) {
//       try {
//         await socket.sendMessage(contato, { text: mensagem });
//         console.log(`✅ Mensagem enviada para: ${contato}`);
//         sucessos++;

//         // Delay para evitar spam (2-5 segundos aleatório)
//         const delay = 2000 + Math.random() * 3000;
//         await new Promise(resolve => setTimeout(resolve, delay));

//       } catch (err) {
//         console.error(`❌ Erro ao enviar para ${contato}:`, err.message);
//         erros++;
//       }
//     }

//     return {
//       total: contatos.length,
//       sucessos,
//       erros,
//       mensagem
//     };

//   } catch (error) {
//     console.error('Erro geral no envio:', error);
//     throw error;
//   }
// }

// // Endpoint para enviar bom dia
// app.post('/send-bom-dia', async (req, res) => {
//   try {
//     if (!isConnected || !globalSocket) {
//       return res.status(400).json({
//         success: false,
//         message: 'Bot não está conectado. Inicialize primeiro.'
//       });
//     }

//     console.log('📨 Iniciando envio de bom dia...');
//     const resultado = await enviarBomDia(globalSocket);

//     res.json({
//       success: true,
//       message: `✅ Envio concluído! ${resultado.sucessos}/${resultado.total} mensagens enviadas com sucesso.`,
//       detalhes: resultado
//     });

//   } catch (error) {
//     console.error('Erro no endpoint send-bom-dia:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Erro ao enviar mensagens: ' + error.message
//     });
//   }
// });

// // Endpoint para desconectar
// app.post('/disconnect', (req, res) => {
//   try {
//     if (globalSocket) {
//       globalSocket.logout();
//       globalSocket.end();
//       globalSocket = null;
//     }
//     isConnected = false;
//     qrCodeData = null;

//     res.json({
//       success: true,
//       message: 'Bot desconectado com sucesso!'
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Erro ao desconectar: ' + error.message
//     });
//   }
// });

// // Inicializar servidor
// app.listen(PORT, async () => {
//   console.log(`🚀 Servidor rodando na porta ${PORT}`);
//   console.log(`🌐 Acesse: http://localhost:${PORT}`);

//   // Tentar conectar automaticamente se já tem credenciais salvas
//   const authDir = path.join(__dirname, 'auth_info_baileys');
//   if (fs.existsSync(authDir) && fs.readdirSync(authDir).length > 0) {
//     console.log('🔄 Tentando reconectar automaticamente...');
//     try {
//       globalSocket = await createSocket();
//     } catch (error) {
//       console.log('⚠️ Falha na reconexão automática:', error.message);
//     }
//   }
// });

// // Graceful shutdown
// process.on('SIGINT', () => {
//   console.log('🔄 Encerrando bot...');
//   if (globalSocket) {
//     globalSocket.end();
//   }
//   process.exit(0);
// });