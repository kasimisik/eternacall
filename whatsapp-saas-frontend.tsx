import React, { useState, useEffect } from 'react';
import { Phone, MessageCircle, Users, Settings, Zap } from 'lucide-react';

export default function WhatsAppSaaS() {
  const [userId] = useState('user_' + Math.random().toString(36).substr(2, 9));
  const [status, setStatus] = useState('disconnected');
  const [trial, setTrial] = useState(0);
  const [qrCode, setQrCode] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [targetPhone, setTargetPhone] = useState('');

  const API_BASE = 'http://localhost:3001/api';

  useEffect(() => {
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/status/${userId}`);
      const data = await res.json();
      setStatus(data.status);
      setTrial(data.trial);
      
      if (data.status === 'disconnected') {
        const qrRes = await fetch(`${API_BASE}/qr/${userId}`);
        const qrData = await qrRes.json();
        if (qrData.qr) setQrCode(qrData.qr);
      } else {
        setQrCode('');
      }
    } catch (e) {
      console.error('Status check failed:', e);
    }
  };

  const register = async () => {
    if (!phone) return;
    try {
      await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, phone })
      });
      setTrial(100);
    } catch (e) {
      console.error('Registration failed:', e);
    }
  };

  const connect = async () => {
    try {
      await fetch(`${API_BASE}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
    } catch (e) {
      console.error('Connection failed:', e);
    }
  };

  const sendMessage = async () => {
    if (!targetPhone || !message) return;
    try {
      const res = await fetch(`${API_BASE}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, phone: targetPhone, message })
      });
      const data = await res.json();
      if (data.success) {
        setTrial(data.remaining);
        setMessage('');
        setTargetPhone('');
      }
    } catch (e) {
      console.error('Send failed:', e);
    }
  };

  const disconnect = async () => {
    try {
      await fetch(`${API_BASE}/disconnect/${userId}`, { method: 'DELETE' });
      setStatus('disconnected');
      setQrCode('');
    } catch (e) {
      console.error('Disconnect failed:', e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-3 mb-8">
          <MessageCircle className="w-8 h-8 text-green-500" />
          <h1 className="text-3xl font-bold">WhatsApp SaaS</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Status Card */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-6 h-6 text-yellow-500" />
              <h2 className="text-xl font-semibold">Status</h2>
            </div>
            <div className="space-y-3">
              <div className={`px-3 py-2 rounded ${status === 'connected' ? 'bg-green-800 text-green-200' : 'bg-red-800 text-red-200'}`}>
                {status === 'connected' ? 'Bağlı' : 'Bağlı Değil'}
              </div>
              <div className="text-gray-300">
                Trial Mesaj: <span className="text-white font-bold">{trial}</span>
              </div>
              <div className="text-sm text-gray-400">
                ID: {userId.substring(0, 8)}...
              </div>
            </div>
          </div>

          {/* Setup Card */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Phone className="w-6 h-6 text-blue-500" />
              <h2 className="text-xl font-semibold">Kurulum</h2>
            </div>
            {status === 'disconnected' ? (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="WhatsApp Numaranız (90555...)"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <div className="space-y-2">
                  <button 
                    onClick={register}
                    className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition"
                    disabled={!phone}
                  >
                    Kayıt Ol (100 Trial)
                  </button>
                  <button 
                    onClick={connect}
                    className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition"
                  >
                    WhatsApp'a Bağlan
                  </button>
                </div>
                {qrCode && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-400 mb-2">QR Kodu WhatsApp ile tarayın:</p>
                    <div className="bg-white p-2 rounded">
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrCode}`} alt="QR" className="w-full" />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={disconnect}
                className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition"
              >
                Bağlantıyı Kes
              </button>
            )}
          </div>

          {/* Send Message Card */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <MessageCircle className="w-6 h-6 text-green-500" />
              <h2 className="text-xl font-semibold">Mesaj Gönder</h2>
            </div>
            {status === 'connected' && trial > 0 ? (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Hedef Numara (90555...)"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                />
                <textarea
                  placeholder="Mesajınız..."
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-24 resize-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <button 
                  onClick={sendMessage}
                  className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition"
                  disabled={!targetPhone || !message}
                >
                  Mesaj Gönder ({trial} kalan)
                </button>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-8">
                {status !== 'connected' ? 'Önce WhatsApp\'a bağlanın' : 'Trial mesajınız bitti'}
              </div>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <h3 className="font-semibold">Multi-Session</h3>
            <p className="text-sm text-gray-400">Tek VPS'te birden fazla kullanıcı</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <Zap className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <h3 className="font-semibold">Trial Yönetimi</h3>
            <p className="text-sm text-gray-400">Otomatik mesaj sayacı ve sınırlama</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <Settings className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <h3 className="font-semibold">Zero Dependency</h3>
            <p className="text-sm text-gray-400">Sadece Baileys + Redis + React</p>
          </div>
        </div>
      </div>
    </div>
  );
}