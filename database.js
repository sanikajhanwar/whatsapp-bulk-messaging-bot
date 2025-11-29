import sqlite3 from 'sqlite3';
import path from 'path';

let db;

// Function to connect to and initialize the database
export function connectDb() {
  if (db) return db;

  db = new sqlite3.Database(path.resolve('./employees.db'), (err) => {
    if (err) {
      console.error('Error connecting to the database:', err.message);
    } else {
      console.log('Connected to the SQLite database.');
      initializeDb();
    }
  });

  return db;
}

// Function to create tables if they don't exist
function initializeDb() {
  const createEmployeesTable = `
    CREATE TABLE IF NOT EXISTS employees (
      employeeId TEXT PRIMARY KEY,
      fullName TEXT,
      phoneNumber TEXT,
      email TEXT,
      enabled INTEGER
    );
  `;

  // --- NEW CODE START ---
  // Create the new 'groups' table to store group information
  const createGroupsTable = `
    CREATE TABLE IF NOT EXISTS groups (
      employeeId TEXT NOT NULL,
      groupId TEXT NOT NULL,
      groupName TEXT,
      employeeEmail TEXT,
      lastUpdated DATETIME,
      PRIMARY KEY (employeeId, groupId)
    );
  `;
   const createCampaignsTable = `
    CREATE TABLE IF NOT EXISTS campaigns (
      campaignId TEXT PRIMARY KEY,
      fileName TEXT,
      totalMessages INTEGER,
      status TEXT, 
      uploadTimestamp DATETIME
    );
  `;

  const createMessageLogsTable = `
    CREATE TABLE IF NOT EXISTS message_logs (
      logId INTEGER PRIMARY KEY AUTOINCREMENT,
      campaignId TEXT NOT NULL,
      recipient TEXT NOT NULL,
      sender TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL, -- e.g., 'Pending', 'Sent', 'Failed'
      errorMessage TEXT,
      durationMs INTEGER,
      timestamp DATETIME NOT NULL
    );
  `;
  // --- NEW CODE END ---

  db.serialize(() => {
    db.run(createEmployeesTable, (err) => {
      if (err) console.error("Error creating employees table:", err.message);
    });
    // --- NEW CODE START ---
    // Run the command to create the new table
    db.run(createGroupsTable, (err) => {
      if (err) console.error("Error creating groups table:", err.message);
    });
     db.run(createCampaignsTable, (err) => {
        if (err) console.error("Error creating campaigns table:", err.message);
    });
    db.run(createMessageLogsTable, (err) => {
        if (err) console.error("Error creating message_logs table:", err.message);
    });
    // --- NEW CODE END ---
  });
}

// (Existing employee functions remain the same)

export function addEmployee(employee) {
  return new Promise((resolve, reject) => {
    const { employeeId, fullName, phoneNumber, email, enabled } = employee;
    db.run(
      `INSERT INTO employees (employeeId, fullName, phoneNumber, email, enabled) VALUES (?, ?, ?, ?, ?)`,
      [employeeId, fullName, phoneNumber, email, enabled],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

export function getAllEmployees() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM employees', (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

export function getEmployee(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM employees WHERE employeeId = ?', [id], (err, row) => (err ? reject(err) : resolve(row)));
  });
}

export function updateEmployee(id, fields) {
  return new Promise((resolve, reject) => {
    const keys = Object.keys(fields);
    const values = Object.values(fields);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    db.run(`UPDATE employees SET ${setClause} WHERE employeeId = ?`, [...values, id], (err) => (err ? reject(err) : resolve()));
  });
}

export function deleteEmployee(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM employees WHERE employeeId = ?', [id], (err) => (err ? reject(err) : resolve()));
  });
}


// --- NEW HELPER FUNCTIONS FOR THE 'groups' TABLE ---

// Get all groups for a specific employee
export function getGroupsForEmployee(employeeId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM groups WHERE employeeId = ?', [employeeId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Add a new group entry for an employee
export function addGroup(group) {
  const { employeeId, groupId, groupName, employeeEmail } = group;
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO groups (employeeId, groupId, groupName, employeeEmail, lastUpdated) VALUES (?, ?, ?, ?, datetime('now'))`;
    db.run(sql, [employeeId, groupId, groupName, employeeEmail], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// Update an existing group's name
export function updateGroupName(employeeId, groupId, newName) {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE groups SET groupName = ?, lastUpdated = datetime('now') WHERE employeeId = ? AND groupId = ?`;
    db.run(sql, [newName, employeeId, groupId], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// Remove a specific group for an employee
export function removeGroup(employeeId, groupId) {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM groups WHERE employeeId = ? AND groupId = ?`;
    db.run(sql, [employeeId, groupId], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// Update the timestamp for all of an employee's groups after a sync
export function updateSyncTimestampForEmployee(employeeId) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE groups SET lastUpdated = datetime('now') WHERE employeeId = ?`;
        db.run(sql, [employeeId], function(err) {
            if (err) return reject(err);
            resolve();
        });
    });
}

// Get all group records from the database
export function getAllGroups() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM groups ORDER BY employeeId, groupName', (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// in database.js, at the end of the file

// --- ADD THESE NEW FUNCTIONS ---

// Create a new campaign entry
export function createCampaign(campaign) {
  return new Promise((resolve, reject) => {
    const { campaignId, fileName, totalMessages, status, uploadTimestamp } = campaign;
    const sql = `INSERT INTO campaigns (campaignId, fileName, totalMessages, status, uploadTimestamp) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [campaignId, fileName, totalMessages, status, uploadTimestamp], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// Update the status of an existing campaign
export function updateCampaignStatus(campaignId, status) {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE campaigns SET status = ? WHERE campaignId = ?`;
    db.run(sql, [status, campaignId], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// Get all campaigns from the database
export function getAllCampaigns() {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM campaigns ORDER BY uploadTimestamp DESC`; // Change to uploadTimestamp
    db.all(sql, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Add a new message log entry
export function addMessageLog(log) {
  return new Promise((resolve, reject) => {
    const { campaignId, recipient, sender, message, status, errorMessage, durationMs, timestamp } = log;
    const sql = `INSERT INTO message_logs (campaignId, recipient, sender, message, status, errorMessage, durationMs, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [campaignId, recipient, sender, message, status, errorMessage, durationMs, timestamp], function(err) {
      if (err) return reject(err);
      resolve(this.lastID); // returns the id of the new row
    });
  });
}

// Update an existing message log (e.g., to change status from 'Pending' to 'Sent')
export function updateMessageLog(logId, newStatus, durationMs, errorMessage = null) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE message_logs SET status = ?, durationMs = ?, errorMessage = ? WHERE logId = ?`;
        db.run(sql, [newStatus, durationMs, errorMessage, logId], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

// Get all logs for a specific campaignId
export function getLogsForCampaign(campaignId) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM message_logs WHERE campaignId = ? ORDER BY timestamp ASC`;
    db.all(sql, [campaignId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}
// --- END OF NEW FUNCTIONS ---

// Get all logs for an array of campaignIds
export function getLogsForCampaigns(campaignIds) {
  return new Promise((resolve, reject) => {
    if (!campaignIds || campaignIds.length === 0) {
      return resolve([]); // Return empty array if no IDs are provided
    }
    // Create placeholders (?,?,?) for the SQL query
    const placeholders = campaignIds.map(() => '?').join(',');
    const sql = `SELECT * FROM message_logs WHERE campaignId IN (${placeholders}) ORDER BY timestamp ASC`;
    
    db.all(sql, campaignIds, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}