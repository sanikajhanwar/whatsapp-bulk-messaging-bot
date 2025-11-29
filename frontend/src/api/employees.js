// frontend/src/api/employees.js

const API_BASE_URL = 'http://localhost:3000/api';

// Fetch all employees
export async function fetchEmployees() {
  const res = await fetch(`${API_BASE_URL}/employees`);
  if (!res.ok) throw new Error('Failed to fetch employees');
  return await res.json();
}

// Fetch groups for a specific employee
export async function fetchEmployeeGroups(employeeId) {
  const res = await fetch(`${API_BASE_URL}/employees/${employeeId}/groups`);
  if (!res.ok) throw new Error('Failed to fetch groups');
  return res.json();
}

// Add employee
export async function addEmployee(data) {
  const res = await fetch(`${API_BASE_URL}/employees`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to add employee: ${errorBody}`);
  }
  return await res.json();
}

// Update employee
export async function updateEmployee(id, update) {
  const res = await fetch(`${API_BASE_URL}/employees/${id}`, { // <-- Corrected URL
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(update)
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to update employee: ${errorBody}`);
  }
  return await res.json();
}

// Delete employee
export async function deleteEmployee(id) {
  const res = await fetch(`${API_BASE_URL}/employees/${id}`, { // <-- Corrected URL
    method: 'DELETE'
  });
  if (!res.ok) {
     const errorBody = await res.text();
    throw new Error(`Failed to delete employee: ${errorBody}`);
  }
  return await res.json();
}