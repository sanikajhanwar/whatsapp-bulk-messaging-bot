import fs from 'fs';
import path from 'path';
import express from 'express';
import qrcode from 'qrcode-terminal';
import csv from 'csv-parser';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import pkg from 'whatsapp-web.js';
import * as db from './database.js';
import { fileURLToPath } from 'url';
import 'dotenv/config'; 
import { uploadImageToImgBB } from './imgbbUpload.js';
import Papa from 'papaparse';
import { enqueueMessage, messageQueues } from './messageQueue.js';
import * as googleSheets from './googleSheets.js';
import * as googleSheet from './googleSheets.js';
import { 
    createCampaign, 
    addMessageLog, 
    updateMessageLog, 
    getAllCampaigns, 
    getLogsForCampaign,
    getLogsForCampaigns,
    updateCampaignStatus
} from './database.js';
process.setMaxListeners(50);

process.on('unhandledRejection', (reason, promise) => {
  console.error('!!!!!!!!!! UNHANDLED REJECTION !!!!!!!!!');
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Server will continue running. This was not a fatal crash.');
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
});

process.on('uncaughtException', (err, origin) => {
  console.error('!!!!!!!!!!! UNCAUGHT EXCEPTION !!!!!!!!!!!');
  console.error(`Caught exception: ${err}\n` + `Exception origin: ${origin}`);
  console.error('Server will continue running. This was not a fatal crash.');
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
});


db.connectDb();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { Client, LocalAuth } = pkg;
const upload = multer({ dest: 'uploads/' });
const app = express();
const port = process.env.PORT || 3000;
const messageStatusLog = [];
const clients = {};
const qrCodes = {};
const clientInitializationPromises = new Map();
// Allow both local development and production domains
const allowedOrigins = [
  'http://localhost:3000', 
  'http://localhost:3001',
  'https://whatsapp-bulk-messaging-bot.vercel.app' // <--- Make sure this matches your Vercel URL exactly
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- WhatsApp Client Management ---

function initWhatsAppClient(employeeId, options = {}) {
  console.log(`--- Starting new initialization for ${employeeId} ---`);

  // 1. Create the Promise wrapper
  const initializationPromise = new Promise((resolve, reject) => {
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: employeeId
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    const timeout = setTimeout(() => {
      console.error(`Initialization timed out for ${employeeId}. Destroying client.`);
      try {
        client.destroy().catch(() => {}); // Catch destroy errors
      } catch (e) {
        /* ignore */ }
      client.removeAllListeners();
      reject(new Error(`Initialization timed out for ${employeeId} after 3 minutes.`));
    }, 180000);

    const readyListener = async () => {
      clearTimeout(timeout);
      console.log(`WhatsApp client ready for ${employeeId}`);
      delete qrCodes[employeeId];
      clients[employeeId] = client;
      db.updateEmployee(employeeId, {
        enabled: 1
      }).catch(console.error);
      resolve(client);

      // --- NEW LOGIC: Only run for new employees ---
      if (options.isNewEmployee) {
        console.log(`New employee detected. Starting automatic group sync for ${employeeId}...`);
        try {
          // Run the group sync
          await syncGroupsForEmployee(employeeId, client);
          console.log(`Initial group sync for ${employeeId} complete.`);
        } catch (err) {
          console.error(`Error during initial sync for ${employeeId}:`, err);
        } finally {
          // CRUCIAL: Shut down the client after sync to save resources
          console.log(`Shutting down client for ${employeeId} after initial sync.`);
          await shutdownClient(employeeId);
        }
      }
    };

    const qrListener = (qr) => {
      qrcode.generate(qr, {
        small: true
      });
      qrCodes[employeeId] = qr;
      console.log(`QR code generated for ${employeeId}`);
    };

    const authFailureListener = (msg) => {
      clearTimeout(timeout);
      console.error(`Auth failure for ${employeeId}. Destroying client.`, msg);
      client.destroy();
      reject(new Error(`Authentication failure for ${employeeId}`));
    };

    const disconnectedListener = (reason) => {
      console.log(`WhatsApp client disconnected for ${employeeId}: ${reason}`);
      delete clients[employeeId];
      clientInitializationPromises.delete(employeeId);
    };

    client.once('ready', readyListener);
    client.on('qr', qrListener);
    client.once('auth_failure', authFailureListener);
    client.on('disconnected', disconnectedListener);

    client.initialize().catch(err => {
      console.error(`client.initialize() failed for ${employeeId}. Destroying client.`, err);
      client.destroy();
      clearTimeout(timeout);
      reject(err);
    });
  });

  // 2. Handle the promise safely
  const safePromise = initializationPromise.catch(err => {
    // The error is logged here, at the source.
    console.error(`Client initialization failed for ${employeeId}: ${err.message}`);
    return null; // Instead of rejecting, resolve with null.
  });

  clientInitializationPromises.set(employeeId, safePromise);
  safePromise.finally(() => {
    clientInitializationPromises.delete(employeeId);
  });

  return safePromise;
}

async function getClient(employeeId) {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[Attempt ${attempt}/${MAX_RETRIES}] Getting client for ${employeeId}...`);

    if (clients[employeeId]) {
      try {
        const state = await clients[employeeId].getState();
        if (state === 'CONNECTED') {
          console.log(`Client for ${employeeId} is already connected.`);
          return clients[employeeId];
        }
      } catch (e) {
        console.log(`Client for ${employeeId} exists but is not responsive. Deleting instance.`);
        delete clients[employeeId];
      }
    }

    if (clientInitializationPromises.has(employeeId)) {
      console.log(`Initialization already in progress for ${employeeId}, awaiting result...`);
      const client = await clientInitializationPromises.get(employeeId);
      if (client) return client; // Success
    }

    // If no client exists or is initializing, start a new initialization
    const client = await initWhatsAppClient(employeeId);

    if (client) {
      // If initialization was successful, return the client immediately
      return client;
    }

    // If initialization failed, log it and prepare for retry
    console.error(`Client initialization failed for ${employeeId} on attempt ${attempt}.`);
    if (attempt < MAX_RETRIES) {
      const retryDelay = 30000; // Wait 30 seconds before retrying
      console.log(`Will retry in ${retryDelay / 1000} seconds...`);
      await delay(retryDelay);
    }
  }

  // If all retries have failed
  console.error(`All ${MAX_RETRIES} initialization attempts failed for ${employeeId}.`);
  return null; // Return null to indicate final failure
}

async function syncGroupsForEmployee(employeeId, client) {
    // This is the new code with better logging
console.log(`Starting group sync for ${employeeId}...`);
try {
    const employee = await db.getEmployee(employeeId);
    if (!employee || !employee.email) {
        console.log(`Sync skipped: Employee ${employeeId} not found or has no email.`);
        return;
    }

    console.log(`Fetching all chats for ${employeeId}. This may take several minutes for accounts with many chats...`);
    const chats = await client.getChats();
    console.log(`Successfully fetched ${chats.length} total chats. Now filtering for groups.`);

    const currentGroups = chats.filter(c => c.isGroup).map(g => ({ groupId: g.id._serialized, groupName: g.name }));
        const currentGroupMap = new Map(currentGroups.map(g => [g.groupId, g]));
        const savedGroups = await db.getGroupsForEmployee(employeeId);
        const savedGroupMap = new Map(savedGroups.map(g => [g.groupId, g]));

        let added = 0, updated = 0, removed = 0;

        const newRowsForSheet = [];
for (const [groupId, currentGroup] of currentGroupMap.entries()) {
    if (!savedGroupMap.has(groupId)) {
        // Add to the local database as before
        await db.addGroup({ employeeId, ...currentGroup, employeeEmail: employee.email });
        
        // Collect the row data instead of sending it immediately
        const newRowData = [employeeId, groupId, currentGroup.groupName, employee.email, new Date().toISOString()];
        newRowsForSheet.push(newRowData);
        
        added++;
    }
}

// After the loop, send all collected rows in a single API call
if (newRowsForSheet.length > 0) {
    console.log(`Batch writing ${newRowsForSheet.length} new rows to Google Sheets...`);
    await googleSheet.batchAppendSheetRows(newRowsForSheet);
}

        for (const [groupId, savedGroup] of savedGroupMap.entries()) {
            if (!currentGroupMap.has(groupId)) {
                await db.removeGroup(employeeId, groupId);
                await googleSheet.deleteSheetRow(groupId);
                removed++;
            } else {
                const currentGroup = currentGroupMap.get(groupId);
                if (savedGroup.groupName !== currentGroup.groupName) {
                    await db.updateGroupName(employeeId, groupId, currentGroup.groupName);
                    await googleSheet.updateSheetRow(groupId, currentGroup.groupName);
                    updated++;
                }
            }
        }
        
        if (added > 0 || updated > 0 || removed > 0) {
             console.log(`Sync details for ${employeeId}: ${added} added, ${updated} updated, ${removed} removed.`);
        } else {
            console.log(`No group changes detected for ${employeeId}. Data is already up-to-date.`);
        }

        await db.updateSyncTimestampForEmployee(employeeId);
        console.log(`Group sync timestamp updated for ${employeeId}.`);

    } catch (error) {
        console.error(`Error during group sync for ${employeeId}:`, error);
    }
}


// Campaign file upload (now handles CSV and JSON)
// in server.js

// --- REPLACE this entire endpoint ---
app.post('/api/upload-campaign', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const campaignId = uuidv4();
  const results = [];
  const filePath = req.file.path;
  const originalFilename = req.file.originalname;

  // This function normalizes the data from the CSV or JSON file.
  function normalizeAndPush(message) {
    const normalizedMsg = {};
    for (const key in message) {
      normalizedMsg[key.trim().toLowerCase()] = message[key];
    }
    const employeeId = normalizedMsg['from'];
    if (!employeeId || employeeId.toLowerCase() === 'na' || employeeId.toLowerCase() === 'n/a') {
      console.warn(`Skipping row due to invalid 'from' value:`, message);
      return;
    }
    function normalizeWhatsAppId(str) {
      if (typeof str === 'string' && (str.endsWith('@c.us') || str.endsWith('@g.us'))) return str;
      return str + '@c.us';
    }
    results.push({
      employeeId: normalizedMsg['from'],
      to: normalizeWhatsAppId(normalizedMsg['phone']),
      message: normalizedMsg['message'],
      imageUrl: normalizedMsg['imageurl'] || '',
      imageBase64: normalizedMsg['imagebase64'] || '',
      campaignId,
    });
  }

  // This function saves the file and the database record.
  const processFile = () => {
    // Save the file permanently using its campaignId as the name
    const newFileName = `${campaignId}${path.extname(originalFilename)}`;
    const newFilePath = path.join(__dirname, 'uploads', newFileName);
    fs.renameSync(filePath, newFilePath); // Move and rename the file

    db.createCampaign({
      campaignId: campaignId,
      fileName: originalFilename,
      totalMessages: results.length,
      status: 'Ready',
      uploadTimestamp: new Date()
    }).then(() => {
      console.log(`Campaign ${campaignId} created in DB and file saved as ${newFileName}.`);
      res.json({ campaignId, messages: results });
    }).catch(err => {
      console.error('Failed to create campaign in DB:', err);
      // If DB save fails, clean up the saved file
      if (fs.existsSync(newFilePath)) fs.unlinkSync(newFilePath);
      res.status(500).json({ error: 'Failed to save campaign details.' });
    });
  };

  // Logic to handle JSON files
  if (req.file.originalname.toLowerCase().endsWith('.json')) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const messages = JSON.parse(fileContent);
      if (!Array.isArray(messages)) throw new Error('JSON must be an array of messages.');
      messages.forEach(normalizeAndPush);
      processFile(); // This call is now correct
    } catch (err) {
      fs.unlinkSync(filePath); // Clean up temp file on failure
      return res.status(500).json({ error: 'Failed to parse JSON file.', details: err.message });
    }
  }
  // Logic to handle CSV files
  else {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => normalizeAndPush(row))
      .on('end', processFile) // This call was already correct
      .on('error', (err) => {
        fs.unlinkSync(filePath); // Clean up temp file on failure
        res.status(500).json({ error: 'Failed to parse CSV', details: err.message });
      });
  }
});


// Message sending with campaignId and dynamic employee lookup
// in server.js

// --- REPLACE this entire endpoint ---
app.post('/api/start-campaign', async (req, res) => {
  const { messages, campaignId } = req.body;
  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: 'No messages to send.' });
  }

  // Immediately respond to the UI
  res.status(202).json({ success: true, message: 'Campaign accepted for processing.' });

  // This async function will run in the background
  const processCampaignInBatches = async () => {
    console.log(`--- Starting campaign ${campaignId} with ${messages.length} messages ---`);

    try {
      // 1. Set campaign status to 'Running'
      await db.updateCampaignStatus(campaignId, 'Running');

      // 2. Create all message logs in the database with 'Pending' status
      const logPromises = messages.map(msg => {
        const logEntry = {
          campaignId: campaignId,
          recipient: msg.to,
          sender: msg.employeeId,
          message: msg.message || '',
          status: 'Pending',
          timestamp: new Date()
        };
        return db.addMessageLog(logEntry);
      });
      const logIds = await Promise.all(logPromises); // Get all the new log IDs

      // 3. Group messages by employee
      const messagesByEmployee = new Map();
      messages.forEach((msg, index) => {
        if (!messagesByEmployee.has(msg.employeeId)) {
          messagesByEmployee.set(msg.employeeId, []);
        }
        // Attach the database logId to the message object
        msg.logId = logIds[index]; 
        messagesByEmployee.get(msg.employeeId).push(msg);
      });

      // 4. Process the campaign one employee at a time
      for (const [employeeId, employeeMessages] of messagesByEmployee.entries()) {
        console.log(`--- Starting batch for employee: ${employeeId} (${employeeMessages.length} messages) ---`);
        let client = null;
        try {
          client = await getClient(employeeId);
          if (!client) {
            console.error(`Skipping batch for ${employeeId}: Client failed to initialize.`);
            // Mark all messages for this failed client as 'Failed'
            for (const msg of employeeMessages) {
                await db.updateMessageLog(msg.logId, 'Failed', 0, 'Client initialization failed.');
            }
            continue;
          }
          
          // Smart Sync logic remains the same
          const savedGroups = await db.getGroupsForEmployee(employeeId);
            let needsSync = savedGroups.length === 0;
            if (!needsSync) {
              const lastUpdated = new Date(savedGroups[0].lastUpdated);
              const hoursSinceUpdate = (new Date() - lastUpdated) / (3600 * 1000);
              if (hoursSinceUpdate > 48) {
                console.log(`Group data for ${employeeId} is stale. Triggering sync.`);
                needsSync = true;
              } else {
                console.log(`Group data for ${employeeId} is fresh. Skipping sync.`);
              }
            }
            if (needsSync) {
              await syncGroupsForEmployee(employeeId, client);
            }

          // 5. Enqueue all messages for this employee
          for (const msg of employeeMessages) {
            const startTime = new Date();
            // The callback now updates the DB instead of an array
            const logCallback = (error) => {
              const endTime = new Date();
              const durationMs = endTime - startTime;
              const finalStatus = error ? 'Failed' : 'Sent';
              const errorMessage = error ? error.message : null;
              db.updateMessageLog(msg.logId, finalStatus, durationMs, errorMessage);
            };
            await enqueueMessage(employeeId, client, msg, logCallback);
          }
          
          // 6. Wait for this employee's queue to finish
          while (messageQueues[employeeId] && (messageQueues[employeeId].running || messageQueues[employeeId].queue.length > 0)) {
            await delay(2000);
          }
          
        } catch (err) {
          console.error(`An error occurred during the batch for ${employeeId}:`, err.message);
        } finally {
          if (client) {
            await shutdownClient(employeeId);
          }
          console.log("Waiting 5 seconds for resources to free up before next batch...");
          await delay(5000); // Wait 5 seconds before starting the next employee
        }
      }
      // 7. Mark the entire campaign as 'Completed'
      await db.updateCampaignStatus(campaignId, 'Completed');
      console.log(`--- Campaign ${campaignId} batch processing finished ---`);

    } catch (dbError) {
      console.error(`A database error occurred during campaign processing for ${campaignId}:`, dbError);
      // Optionally, mark the campaign as 'Failed'
      await db.updateCampaignStatus(campaignId, 'Failed');
    }
  };

  processCampaignInBatches();
});
// ADD THIS NEW ENDPOINT for manual group sync

// REPLACE the existing endpoint with this updated version

app.post('/api/sync-all-groups', (req, res) => {
  // Immediately respond to the UI so it doesn't have to wait
  res.status(202).json({ success: true, message: 'Full group sync process has been started.' });

  // This async function will run in the background
  const runFullGroupSync = async () => {
    console.log(`--- Starting manual group sync with 15-hour check ---`);
    const employees = await db.getAllEmployees();
    const enabledEmployees = employees.filter(emp => emp.enabled);

    console.log(`Found ${enabledEmployees.length} enabled employees to check.`);

    // Process the sync one employee at a time
    for (const employee of enabledEmployees) {
      const employeeId = employee.employeeId;
      let client = null;
      try {
        // --- NEW LOGIC START ---
        // Check if a sync is actually needed for this employee
        const savedGroups = await db.getGroupsForEmployee(employeeId);
        let needsSync = false;
        if (savedGroups.length === 0) {
          console.log(`[${employeeId}] Needs sync: No previous group data found.`);
          needsSync = true;
        } else {
          const lastUpdated = new Date(savedGroups[0].lastUpdated);
          const hoursSinceUpdate = (new Date() - lastUpdated) / (3600 * 1000);
          if (hoursSinceUpdate > 24) {
            console.log(`[${employeeId}] Needs sync: Data is ${hoursSinceUpdate.toFixed(1)} hours old (older than 15).`);
            needsSync = true;
          } else {
            console.log(`[${employeeId}] Sync skipped: Data is fresh (${hoursSinceUpdate.toFixed(1)} hours old).`);
          }
        }
        // --- NEW LOGIC END ---

        if (needsSync) {
            console.log(`--- Starting sync for employee: ${employeeId} ---`);
            // Initialize the client for this employee
            client = await getClient(employeeId);
            if (!client) {
              console.error(`Skipping sync for ${employeeId}: Client failed to initialize.`);
              continue; // Skip to the next employee
            }
    
            // Run the group sync function
            await syncGroupsForEmployee(employeeId, client);
            console.log(`Sync completed for ${employeeId}.`);
        }

      } catch (err) {
        console.error(`An error occurred during the sync for ${employeeId}:`, err.message);
      } finally {
        // Shut down the client only if it was initialized
        if (client) {
          console.log(`--- Shutting down client for ${employeeId} to free resources... ---`);
          await shutdownClient(employeeId);
        }
      }
    }
    console.log(`--- Manual group sync check finished ---`);
  };

  runFullGroupSync().catch(err => {
    console.error(`A top-level error occurred during the full group sync process:`, err);
  });
});

// Get message logs filtered by campaignId
app.get('/api/message-log', async (req, res) => {
  const { campaignId } = req.query;
  if (!campaignId) {
    return res.status(400).json({ error: 'Campaign ID is required' });
  }
  try {
    const logs = await db.getLogsForCampaign(campaignId);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch message logs.' });
  }
});

app.post('/api/message-logs/bulk', async (req, res) => {
  const { campaignIds } = req.body;

  if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
    return res.status(400).json({ error: 'An array of campaignIds is required.' });
  }

  try {
    const logs = await db.getLogsForCampaigns(campaignIds);
    res.json(logs);
  } catch (err) {
    console.error('Error fetching bulk message logs:', err);
    res.status(500).json({ error: 'Failed to fetch message logs.' });
  }
});
// Get campaigns list from the DATABASE
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await db.getAllCampaigns();
    const formattedCampaigns = campaigns.map(c => ({
        campaignId: c.campaignId,
        originalFilename: c.fileName, // Change to fileName
        uploadedAt: c.uploadTimestamp // Change to uploadTimestamp
    }));
    res.json(formattedCampaigns);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaigns.' });
  }
});


// Download campaign CSV
app.get('/api/download-campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    // We must query the database to get the original filename
    const campaigns = await db.getAllCampaigns();
    const campaign = campaigns.find(c => c.campaignId === campaignId);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found in database.' });
    }

    const originalFilename = campaign.fileName;
    const fileExtension = path.extname(originalFilename); // Gets .csv or .json
    const filePath = path.join(__dirname, 'uploads', `${campaignId}${fileExtension}`);

    if (fs.existsSync(filePath)) {
      // Serve the file for download with its original, user-friendly name
      res.download(filePath, originalFilename);
    } else {
      res.status(404).json({ error: 'Campaign source file not found on server.' });
    }
  } catch (err) {
    console.error('Error downloading campaign file:', err);
    res.status(500).json({ error: 'Server error while downloading file.' });
  }
});

// GET /api/qr/:employeeId — returns QR code string if exists
app.get('/api/qr/:employeeId', (req, res) => {
  const { employeeId } = req.params;
  const qr = qrCodes[employeeId];
  if (qr) {
    res.json({ qr });
  } else {
    res.status(404).json({ error: 'QR code not available or client authenticated' });
  }
});

// New API route to fetch all WhatsApp groups for a specific employee
app.get('/api/employees/:employeeId/groups', async (req, res) => {
  const { employeeId } = req.params;
  const client = clients[employeeId];
  if (!client) {
    return res.status(404).json({ error: 'No WhatsApp client for this employee.' });
  }

  try {
    const chats = await client.getChats();
    const groups = chats
      .filter(chat => chat.isGroup)
      .map(group => ({
        id: group.id._serialized,  // e.g., "1234567890-123456789@g.us"
        name: group.name,
      }));

    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch groups.', details: error.message });
  }
});


// --- ADD THIS NEW ROUTE ---
app.get('/api/download-groups-csv', async (req, res) => {
  try {
    console.log('Request received to download groups CSV.');
    const groups = await db.getAllGroups();

    if (groups.length === 0) {
      return res.status(404).json({ error: 'No group data available to download.' });
    }

    // Convert the JSON data to a CSV string
    const csv = Papa.unparse(groups);

    // Set headers to trigger a browser download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="whatsapp-groups.csv"');
    res.status(200).send(csv);

  } catch (err) {
    console.error('Error exporting groups CSV:', err);
    res.status(500).json({ error: 'Failed to export groups data.' });
  }
});

app.get('/api/employees', async (req, res) => {
  try {
    const employees = await db.getAllEmployees();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employees.' });
  }
});
app.put('/api/employees/:id', async (req, res) => {
  const id = req.params.id;
  const fields = req.body;
  try {
    await db.updateEmployee(id, fields);
    if ('enabled' in fields) {
      if (fields.enabled) {
        initWhatsAppClient(id, { isNewEmployee: true });
      } else if (clients[id]) {
        await clients[id].destroy();
        delete clients[id];
      }
    }
    const updated = await db.getEmployee(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await db.deleteEmployee(id);
    if (clients[id]) {
      await clients[id].destroy();
      delete clients[id];
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete employee' });
  } 
});

app.post('/api/employees', async (req, res) => {
  const { employeeId, fullName, phoneNumber, email } = req.body;

  if (!employeeId) {
    return res.status(400).json({ error: 'Employee ID is required' });
  }

  try {
    const exists = await db.getEmployee(employeeId);
    if (exists) {
      return res.status(409).json({ error: 'Employee ID already exists' });
    }

    const newEmployee = {
      employeeId,
      fullName,
      phoneNumber,
      email,
      enabled: 1,
    };

    await db.addEmployee(newEmployee);
    initWhatsAppClient(employeeId, { isNewEmployee: true });  


    res.status(201).json(newEmployee);
  } catch (err) {
    console.error('Error adding employee:', err);
    res.status(500).json({ error: 'Server error while adding employee' });
  }
});

const server = app.listen(port, () => { 
  console.log(`Server listening on port ${port}. Ready for on-demand initialization.`);
});

// Graceful shutdown handlers to close WhatsApp clients cleanly
async function shutdownClient(employeeId) {
  if (clients[employeeId]) {
    try {
      // Check if pupBrowser exists before trying to close it
      if (clients[employeeId].pupBrowser) {
        await clients[employeeId].destroy();
      } else {
        // If pupBrowser is null, just manually remove listeners to be safe
        clients[employeeId].removeAllListeners();
      }
      console.log(`Client for ${employeeId} shutdown cleanly.`);
    } catch (err) {
      console.error(`Error shutting down client ${employeeId}:`, err.message);
    } finally {
      // Always remove the reference
      delete clients[employeeId];
      delete qrCodes[employeeId]; // Also clear any stale QR codes
    }
  }
}

async function shutdownAllClients() {
  for (const employeeId of Object.keys(clients)) {
    await shutdownClient(employeeId);
  }
}

process.on('SIGINT', async () => {
  console.log('Received SIGINT. Shutting down WhatsApp clients...');
  await shutdownAllClients();
  server.close(() => {
    console.log('Express server closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Shutting down WhatsApp clients...');
  await shutdownAllClients();
  server.close(() => {
    console.log('Express server closed.');
    process.exit(0);
  });
});