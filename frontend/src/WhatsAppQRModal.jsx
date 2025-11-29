// frontend/src/WhatsAppQRModal.jsx
import React, { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { BASE_URL } from './config';

export default function WhatsAppQRModal({ employeeId, onClose }) {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let intervalId;

    const fetchQr = async () => {
      try {
        const res = await fetch(`\${BASE_URL}/api/qr/${employeeId}`);
        if (res.status === 404) {
            setQr(null);
            setError(null);
            clearInterval(intervalId);
            onClose(true);
            return;
          }

        if (!res.ok) throw new Error('Failed to fetch QR code');

        const data = await res.json();
        if (data.qr) {
          setQr(data.qr);
          setError(null);
        } else if (data.message === 'Client is ready') {
          setQr(null);
          setError(null);
          clearInterval(intervalId);
        } else {
          setError('Unexpected response from server');
        }
      } catch (err) {
        setError('Failed to fetch QR code');
      }
    };

    fetchQr();
    intervalId = setInterval(fetchQr, 3000);

    return () => clearInterval(intervalId);
  }, [employeeId, onClose]);

  return (
    <div className="modal">
      <h2>WhatsApp QR Setup</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {qr ? (
        <>
          <QRCodeCanvas value={qr} size={256} />
          <p>Please scan this QR code with WhatsApp on your phone to link your account.</p>
        </>
      ) : !error ? (
        <p>WhatsApp client is ready! You can now send messages.</p>
      ) : null}
      <button onClick={onClose}>Close</button>
    </div>
  );
}
