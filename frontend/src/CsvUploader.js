import React, { useState } from 'react';
import { BASE_URL } from './config';

export default function CsvUploader() {
  const [file, setFile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [campaignId, setCampaignId] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false); 

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessages([]);
    setError('');
    setSendError('');
    setCampaignId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSendError('');
    setError('');
    if (!file) {
      setError('Please select a CSV file');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('\${BASE_URL}/api/upload-campaign', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error || 'Failed to upload file');
        return;
      }

      const data = await res.json();
      setMessages(data.messages || []);
      setCampaignId(data.campaignId);
      setError('');
    } catch (err) {
      setError('Error connecting to server');
    }
  };
   const handleSyncGroups = async () => {
    const isConfirmed = window.confirm(
      'This will start a full group data sync for all employees. It can take several minutes to complete. Are you sure you want to proceed?'
    );

    if (!isConfirmed) {
      return;
    }

    setIsSyncing(true);
    
    try {
      const res = await fetch('\${BASE_URL}/api/sync-all-groups', {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Server responded with an error.');
      }
      
      alert('Group sync process has started in the background. You can monitor the progress in your server console. This may take a while.');

    } catch (err) {
      alert(`Error starting sync process: ${err.message}`);
      console.error('Sync initiation failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // in CsvUploader.js

const sendMessages = async () => {
  setSending(true);
  setSendError('');

  try {
    const res = await fetch('\${BASE_URL}/api/start-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Send the entire messages array at once
      body: JSON.stringify({ messages: messages, campaignId: campaignId }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start campaign.');
    }

    // The UI now shows a success message immediately. The work happens in the background.
    alert('Campaign started successfully! You can monitor its progress on the Monitoring page.');

  } catch (err) {
    setSendError(`Error: ${err.message}`);
  }

  setSending(false);
};

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 900,
        margin: 'auto',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <h2 style={{ marginBottom: 20, fontWeight: 700, fontSize: 28 }}>Upload CSV/JSON Campaign</h2>
      <div style={{ marginBottom: '24px' }}>
      <a
        href="http://localhost:3000/api/download-groups-csv"
        download
        style={{
          padding: '10px 18px',
          backgroundColor: '#10B981',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '15px'
        }}
      >
        Download Group Data (CSV)
      </a>
      <button
    onClick={handleSyncGroups} // We will create this function in the next step
    disabled={isSyncing}
    style={{
      marginLeft: '16px',
      padding: '10px 18px',
      backgroundColor: isSyncing ? '#9CA3AF' : '#10B981',
      color: 'white',
      textDecoration: 'none',
      borderRadius: '8px',
      fontWeight: 600,
      fontSize: '15px',
      border: 'none',
      cursor: isSyncing ? 'not-allowed' : 'pointer',
    }}
  >
    {isSyncing ? 'Syncing...' : 'Update Group Data'}
  </button>
  </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <input
          type="file"
          accept=".csv,.json"
          onChange={handleFileChange}
          style={{
            padding: 10,
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            cursor: 'pointer',
            flex: 1,
          }}
        />
        <button
          type="submit"
          style={{
            padding: '12px 28px',
            backgroundColor: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
            transition: 'background-color 0.3s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e40af')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
        >
          Upload
        </button>
      </form>
      {error && (
        <p style={{ color: '#ef4444', fontWeight: 600, marginTop: -14, marginBottom: 18, whiteSpace: 'pre-wrap' }}>{error}</p>
      )}

      {messages.length > 0 && (
        <>
          <h3 style={{ marginBottom: 16, fontWeight: 600, fontSize: 20 }}>Parsed Messages</h3>
          <div style={{ overflowX: 'auto', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', borderRadius: 12 }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 700,
                backgroundColor: '#fff',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <thead style={{ backgroundColor: '#f3f4f6', fontWeight: 600, fontSize: 15 }}>
                <tr>
                  <th style={{ padding: '12px 20px', textAlign: 'left' }}>Employee ID</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left' }}>To (WhatsApp ID)</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left' }}>Message</th>
                  {/* CHANGE 1: Updated table header */}
                  <th style={{ padding: '12px 20px', textAlign: 'left' }}>Image</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: i !== messages.length - 1 ? '1px solid #e5e7eb' : 'none',
                      fontSize: 15,
                      color: '#334155',
                    }}
                  >
                    <td style={{ padding: '14px 20px' }}>{msg.employeeId}</td>
                    <td style={{ padding: '14px 20px' }}>{msg.to}</td>
                    {/* CHANGE 2: Added 'whiteSpace' to preserve line breaks in the message */}
                    <td style={{ padding: '14px 20px', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.message}</td>
                    {/* CHANGE 3: Updated logic to show status for both imageUrl and imageBase64 */}
                    <td style={{ padding: '14px 20px' }}>
                      {msg.imageUrl ? (
                        <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
                          View Image
                        </a>
                      ) : msg.imageBase64 ? (
                        <span style={{ color: '#059669', fontWeight: 500 }}>Base64 Image Included</span>
                      ) : (
                        'N/A'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={sendMessages}
            disabled={sending}
            style={{
              marginTop: 24,
              padding: '12px 36px',
              backgroundColor: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 16,
              cursor: sending ? 'not-allowed' : 'pointer',
              boxShadow: sending ? 'none' : '0 4px 14px rgba(37,99,235,0.3)',
              transition: 'background-color 0.3s',
            }}
            onMouseEnter={(e) => !sending && (e.currentTarget.style.backgroundColor = '#1e40af')}
            onMouseLeave={(e) => !sending && (e.currentTarget.style.backgroundColor = '#2563eb')}
          >
            {sending ? 'Sending...' : 'Send Messages'}
          </button>
          {sending && (
            <div style={{ marginTop: 14, fontStyle: 'italic', color: '#475569' }}>
              Sending... You can monitor progress on the{' '}
              <a href="/monitoring" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                Monitoring
              </a>{' '}
              page.
            </div>
          )}
          {sendError && (
            <div
              style={{
                marginTop: 12,
                color: '#ef4444',
                whiteSpace: 'pre-line',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {sendError}
            </div>
          )}
        </>
      )}
    </div>
  );
}