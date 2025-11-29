import React, { useState, useEffect } from 'react';
import EmployeeAddModal from '../EmployeeAddModal';
import WhatsAppQRModal from '../WhatsAppQRModal';
import { fetchEmployees, updateEmployee, deleteEmployee, fetchEmployeeGroups } from '../api/employees';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [qrEmployeeId, setQrEmployeeId] = useState(null);
  const [groups, setGroups] = useState([]);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  useEffect(() => {
    fetchEmployees().then(setEmployees).catch(console.error);
  }, []);

  const handleEmployeeCreated = async (id) => {
    setQrEmployeeId(id);
    setShowAddModal(false);
    const updated = await fetchEmployees();
    setEmployees(updated);
  };

  const handleQrModalClose = async () => {
    setQrEmployeeId(null);
    const updated = await fetchEmployees();
    setEmployees(updated);
  };

  const toggleEmployeeEnabled = async (id, enabled) => {
    await updateEmployee(id, { enabled });
    const updated = await fetchEmployees();
    setEmployees(updated);
  };

  const handleDeleteEmployee = async (id) => {
    await deleteEmployee(id);
    const updated = await fetchEmployees();
    setEmployees(updated);
  };

  // --- Groups modal logic ---
  const handleViewGroups = async (employeeId) => {
    try {
      setSelectedEmployeeId(employeeId);
      const data = await fetchEmployeeGroups(employeeId);
      setGroups(data);
      setShowGroupsModal(true);
    } catch (e) {
      alert('Could not fetch groups.');
    }
  };

  // Get Initials
  const getInitials = name => name
    ? name.split(' ')
        .filter(word => word.length > 0)
        .map(w => w[0].toUpperCase())
        .slice(0, 2)
        .join('')
    : 'NA';

  return (
    <div style={{ padding: '36px 16px', maxWidth: 1100, margin: 'auto', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <h1 style={{ fontWeight: 700, fontSize: 32 }}>Employee Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            backgroundColor: '#2563eb',
            border: 'none',
            borderRadius: 10,
            color: '#fff',
            padding: '14px 30px',
            fontWeight: 600,
            fontSize: 17,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(37,99,235,0.12)',
          }}>+ Add Employee</button>
      </div>

      {showAddModal && (
        <EmployeeAddModal
          onClose={() => setShowAddModal(false)}
          onEmployeeCreated={handleEmployeeCreated}
        />
      )}

      {qrEmployeeId && (
        <WhatsAppQRModal
          employeeId={qrEmployeeId}
          onClose={handleQrModalClose}
        />
      )}

      <div style={{ marginTop: 10, background: '#f9fafc', borderRadius: 12, boxShadow: '0 2px 12px rgba(37,99,235,0.07)' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          minWidth: 700,
          fontSize: 17,
        }}>
          <thead>
            <tr style={{
              backgroundColor: '#f3f4f6',
              textAlign: 'left',
              fontWeight: 700,
              fontSize: 17
            }}>
              <th style={{ padding: '13px 18px' }}>Employee ID</th>
              <th style={{ padding: '13px 0' }}>Employee</th>
              <th style={{ padding: '13px 18px' }}>Phone</th>
              <th style={{ padding: '13px 18px' }}>Status</th>
              <th style={{ padding: '13px 18px' }}>Enable/Disable</th>
              <th style={{ padding: '13px 18px' }}>Delete</th>
              <th style={{ padding: '13px 18px' }}>Groups</th>
            </tr>
          </thead>
          <tbody>
            {employees.filter(emp => emp.enabled).map(emp => (
              <tr key={emp.employeeId}
                style={{ backgroundColor: '#fff', borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '18px 18px' }}>
                  <span style={{
                    fontWeight: 600,
                    color: '#334155',
                    fontSize: 16,
                  }}>{emp.employeeId}</span>
                </td>
                <td style={{
                  padding: '18px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontWeight: 600,
                }}>
                  <span style={{
                    width: 44,
                    height: 44,
                    display: 'inline-flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontWeight: 800,
                    fontSize: 20,
                    color: '#fff',
                    background: '#2563eb',
                    borderRadius: '50%',
                  }}>
                    {getInitials(emp.fullName)}
                  </span>
                  <span style={{ color: '#0f172a', fontWeight: 600, fontSize: 17 }}>
                    {emp.fullName}
                  </span>
                </td>
                <td style={{ padding: '18px 18px' }}>{emp.phoneNumber}</td>
                <td style={{ padding: '18px 18px', color: '#22c55e', fontWeight: 700 }}>
                  Enabled
                </td>
                <td style={{ padding: '18px 18px' }}>
                  <button
                    onClick={() => toggleEmployeeEnabled(emp.employeeId, false)}
                    style={{
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 7,
                      fontWeight: 600,
                      padding: '7px 22px',
                      fontSize: 15,
                      cursor: 'pointer',
                    }}>Disable</button>
                </td>
                <td style={{ padding: '18px 18px' }}>
                  <button
                    onClick={() => handleDeleteEmployee(emp.employeeId)}
                    style={{
                      background: '#f87171',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 7,
                      fontWeight: 600,
                      padding: '7px 22px',
                      fontSize: 15,
                      cursor: 'pointer',
                    }}>Delete</button>
                </td>
                <td style={{ padding: '18px 18px' }}>
                  <button
                    onClick={() => handleViewGroups(emp.employeeId)}
                    style={{
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 7,
                      fontWeight: 600,
                      padding: '7px 22px',
                      fontSize: 15,
                      cursor: 'pointer',
                    }}>View Groups</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showGroupsModal && (
        <div className="modal" style={{
          position: 'fixed',
          left: 0, top: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.12)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }}>
          <div style={{
            position: 'relative',
            background: '#fff',
            borderRadius: '8px',
            padding: '20px 40px 20px 20px',
            minWidth: '340px',
            maxHeight: '70vh',
            overflowY: 'auto',
            boxShadow: '0 2px 18px rgba(0,0,0,0.15)'
          }}>
            {/* Close (X) button */}
            <button
              onClick={() => setShowGroupsModal(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                fontWeight: 'bold',
                cursor: 'pointer',
                lineHeight: '1rem',
                color: '#555'
              }}
              aria-label="Close modal"
            >
              &times;
            </button>

            <h3>WhatsApp Groups for {selectedEmployeeId}</h3>
            {groups.length > 0 ? (
              <table border="1" cellPadding="6" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Group Name</th>
                    <th>@g.us ID</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => (
                    <tr key={g.id}>
                      <td>{g.name}</td>
                      <td style={{ wordBreak: 'break-all' }}>{g.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No groups found for this employee.</p>
            )}
            <button onClick={() => setShowGroupsModal(false)} style={{ marginTop: '10px' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
