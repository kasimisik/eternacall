// server.js - WhatsApp SaaS Backend
const express = require('express');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const redis = require('redis');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Redis client
const client = redis.createClient();
client.connect();

// Active sessions
const sessions = new Map();

// WhatsApp session manager
class WhatsAppSession {
  constructor(userId) {
    this.userId = userId;
    this.sock = null;
    this.isConnected = false;
  }

  async start() {
    const authDir = `./auth_${this.userId}`;
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir);
    
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: false
    });

    this.sock.ev.on('creds.update', saveCreds);
    
    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        // Store QR for frontend
        client.set(`qr:${this.userId}`, qr, { EX: 300 });
      }
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) this.start();
        else this.isConnected = false;
      } else if (connection === 'open') {
        this.isConnected = true;
        client.set(`status:${this.userId}`, 'connected');
      }
    });

    this.sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;
      
      // Check trial status
      const trial = await client.get(`trial:${this.userId}`);
      if (!trial || parseInt(trial) <= 0) return;
      
      // Decrease trial count
      await client.decr(`trial:${this.userId}`);
      
      // Auto-reply logic
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
      if (text) {
        await this.sendMessage(msg.key.remoteJid, `Bot yanıt: ${text}`);
      }
    });
  }

  async sendMessage(jid, text) {
    if (!this.isConnected) return false;
    await this.sock.sendMessage(jid, { text });
    return true;
  }
}

// Routes
app.post('/api/register', async (req, res) => {
  const { userId, phone } = req.body;
  
  // Set 100 trial messages
  await client.set(`trial:${userId}`, 100);
  await client.set(`phone:${userId}`, phone);
  await client.set(`created:${userId}`, Date.now());
  
  res.json({ success: true, trial: 100 });
});

app.post('/api/connect', async (req, res) => {
  const { userId } = req.body;
  
  if (sessions.has(userId)) {
    return res.json({ error: 'Already connected' });
  }
  
  const session = new WhatsAppSession(userId);
  sessions.set(userId, session);
  session.start();
  
  res.json({ success: true, message: 'Connecting...' });
});

app.get('/api/qr/:userId', async (req, res) => {
  const qr = await client.get(`qr:${req.params.userId}`);
  res.json({ qr });
});

app.get('/api/status/:userId', async (req, res) => {
  const userId = req.params.userId;
  const status = await client.get(`status:${userId}`);
  const trial = await client.get(`trial:${userId}`) || 0;
  
  res.json({ 
    status: status || 'disconnected', 
    trial: parseInt(trial),
    connected: sessions.has(userId) && sessions.get(userId).isConnected 
  });
});

app.post('/api/send', async (req, res) => {
  const { userId, phone, message } = req.body;
  
  const session = sessions.get(userId);
  if (!session || !session.isConnected) {
    return res.json({ error: 'Not connected' });
  }
  
  const trial = await client.get(`trial:${userId}`);
  if (!trial || parseInt(trial) <= 0) {
    return res.json({ error: 'Trial expired' });
  }
  
  const success = await session.sendMessage(`${phone}@s.whatsapp.net`, message);
  if (success) {
    await client.decr(`trial:${userId}`);
    res.json({ success: true, remaining: parseInt(trial) - 1 });
  } else {
    res.json({ error: 'Failed to send' });
  }
});

app.delete('/api/disconnect/:userId', (req, res) => {
  const userId = req.params.userId;
  const session = sessions.get(userId);
  if (session) {
    session.sock?.end();
    sessions.delete(userId);
  }
  res.json({ success: true });
});

// Trial cleanup job - runs every hour
setInterval(async () => {
  const keys = await client.keys('trial:*');
  for (const key of keys) {
    const trial = await client.get(key);
    if (parseInt(trial) <= 0) {
      const userId = key.replace('trial:', '');
      const session = sessions.get(userId);
      if (session) {
        session.sock?.end();
        sessions.delete(userId);
      }
    }
  }
}, 3600000);

app.listen(3001, () => {
  console.log('WhatsApp SaaS running on port 3001');
});
