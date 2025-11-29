import React from 'react';

const Dashboard = () => {
  return (
    <div style={{
      maxWidth: 900,
      margin: '40px auto',
      padding: 24,
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      background: 'linear-gradient(135deg, #f0f4f8 0%, #ffffff 100%)',
      borderRadius: 16,
      boxShadow: '0 12px 28px rgba(0,0,0,0.06)',
      animation: 'fadeIn 0.8s ease-in-out',
    }}>
      <h2 style={{
        textAlign: 'center',
        fontWeight: 700,
        fontSize: 38,
        color: '#1e293b',
        marginBottom: 16,
        position: 'relative',
        display: 'inline-block',
        paddingBottom: 8,
      }}>
        WhatsApp Admin Dashboard
        <span style={{
          content: '""',
          position: 'absolute',
          height: 4,
          borderRadius: 4,
          backgroundColor: '#2563eb',
          width: '60%',
          bottom: 0,
          left: '20%',
        }}></span>
      </h2>

      <section style={{
        backgroundColor: '#f8fafc',
        padding: 30,
        borderRadius: 16,
        color: '#334155',
        lineHeight: 1.65,
        fontSize: 18,
        boxShadow: '0 4px 20px rgba(37, 99, 235, 0.15)',
        userSelect: 'none',
      }}>
        <h3 style={{ fontWeight: 700, marginBottom: 14, fontSize: 24 }}>Welcome to the Project</h3>
        <p>
          This admin dashboard helps you manage employees, upload campaign CSV or JSON files, monitor message delivery status,
          and track campaign progress in an efficient and user-friendly interface.
        </p>
        <p style={{ marginTop: 14 }}>
          Navigate through the sidebar to access different sections and use the features as needed. More functionalities
          will be added soon.
        </p>
      </section>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
