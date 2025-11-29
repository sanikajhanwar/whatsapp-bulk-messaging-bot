import React, { useState } from 'react';

export default function EmployeeAddModal({ onClose, onEmployeeCreated }) {
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!formData.employeeId.trim()) {
      setError('Employee ID is required');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/employees', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: formData.employeeId.trim(),
          fullName: formData.name,
          phoneNumber: formData.phone,
          email: formData.email,
        }),
      });

      const data = await response.json();

      if (response.ok && data.employeeId) {
        onEmployeeCreated(data.employeeId);
        onClose();
      } else {
        setError(data.error || 'Failed to add employee');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: '#fff',
          padding: '32px 36px 28px 36px',
          borderRadius: 16,
          boxShadow: '0 6px 32px rgba(37,99,235,0.12)',
          minWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        }}
      >
        <h2
          style={{
            marginBottom: 8,
            fontWeight: 700,
            fontSize: 22,
            textAlign: 'center',
            color: '#1e293b',
          }}
        >
          Add New Employee
        </h2>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          Employee ID:
          <input
            type="text"
            name="employeeId"
            value={formData.employeeId}
            onChange={handleChange}
            required
            placeholder="Unique ID e.g. EMP001"
            style={{
              padding: '12px 14px',
              fontSize: 16,
              borderRadius: 8,
              border: '1px solid #cbd5e1',
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          Full Name:
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Your Name"
            style={{
              padding: '12px 14px',
              fontSize: 16,
              borderRadius: 8,
              border: '1px solid #cbd5e1',
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          WhatsApp Phone Number:
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+919876543210"
            required
            style={{
              padding: '12px 14px',
              fontSize: 16,
              borderRadius: 8,
              border: '1px solid #cbd5e1',
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          Email Address:
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Work email"
            required
            style={{
              padding: '12px 14px',
              fontSize: 16,
              borderRadius: 8,
              border: '1px solid #cbd5e1',
            }}
          />
        </label>

        {error && (
          <p style={{ color: '#ef4444', fontWeight: 600, margin: 0, textAlign: 'center' }}>{error}</p>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            marginTop: 10,
          }}
        >
          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: '#2563eb',
              color: '#fff',
              fontWeight: 700,
              padding: '14px 36px',
              fontSize: 16,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
              transition: 'background-color 0.25s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e40af')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
          >
            {loading ? 'Adding...' : 'Create Employee'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              backgroundColor: '#f1f5f9',
              color: '#2563eb',
              fontWeight: 700,
              padding: '14px 28px',
              fontSize: 16,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
