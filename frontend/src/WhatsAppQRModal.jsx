import React, { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { BASE_URL } from './config';

export default function WhatsAppQRModal({ employeeId, onClose }) {
  const [qr, setQr] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Waiting for server...');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    
    const fetchQr = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/qr/${employeeId}`);
        
        if (res.status === 404) {
           // It's normal for it to be 404 while Puppeteer is booting up
           if(isMounted) setStatusMessage('Initializing WhatsApp Client... (This takes ~45s)');
           return;
        }

        if (!res.ok) throw new Error('Network response was not ok');

        const data = await res.json();
        
        if (isMounted) {
            if (data.qr) {
              setQr(data.qr);
              setStatusMessage(null);
            } else if (data.message === 'Client is ready') {
              onClose(); // Auto-close if already logged in
            }
        }
      } catch (err) {
        console.warn("Polling error:", err);
        if(isMounted) setStatusMessage('Connecting to server...');
      }
    };

    // Initial fetch
    fetchQr();

    // Poll every 3 seconds
    const intervalId = setInterval(fetchQr, 3000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [employeeId, onClose]);

  return (
    <div className="modal" style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{ background: 'white', padding: '30px', borderRadius: '12px', textAlign: 'center', maxWidth: '400px' }}>
        <h2 style={{marginTop: 0}}>Scan QR Code</h2>
        
        {qr ? (
          <div style={{ margin: '20px 0' }}>
            <QRCodeCanvas value={qr} size={256} />
          </div>
        ) : (
          <div style={{ margin: '40px 0', color: '#666' }}>
            <div className="spinner" style={{marginBottom: '10px'}}>⏳</div>
            {statusMessage}
          </div>
        )}
        
        <p style={{fontSize: '14px', color: '#888'}}>
            Open WhatsApp &gt; Menu &gt; Linked Devices &gt; Link a Device
        </p>
        
        <button onClick={onClose} style={{
            padding: '10px 20px', background: '#f1f1f1', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
        }}>
            Close
        </button>
      </div>
    </div>
  );
}