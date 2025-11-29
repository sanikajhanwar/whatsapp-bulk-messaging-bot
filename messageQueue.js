import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;

export const messageQueues = {};  // { employeeId: { queue: [], running: false } }
const MIN_DELAY_MS = 1000; // 1 second
const MAX_DELAY_MS = 15000; // 15 seconds

// Helper delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Enqueue a message for an employee
export async function enqueueMessage(employeeId, client, messageObj, logCallback) {
  if (!messageQueues[employeeId]) {
    messageQueues[employeeId] = { queue: [], running: false };
  }

  messageQueues[employeeId].queue.push({ client, messageObj, logCallback });

  // Start processing if not already running
  if (!messageQueues[employeeId].running) {
    processQueue(employeeId);
  }
}

async function processQueue(employeeId) {
  const queueData = messageQueues[employeeId];
  if (!queueData) return;

  queueData.running = true;

  while (queueData.queue.length > 0) {
    const { client, messageObj, logCallback } = queueData.queue.shift();

    const start = new Date();

    // Destructure imageBase64 and imageUrl safely from messageObj with defaults
    const { to, message, imageBase64 = null, imageUrl = null } = messageObj;

    // --- THIS IS THE UPDATED SECTION ---
    try {
      // We no longer fetch the chat object first. We send directly to the ID.
      if (imageBase64) {
        let cleanBase64 = imageBase64;
        if (cleanBase64.startsWith('data:')) {
          cleanBase64 = cleanBase64.split(',')[1];
        }
        const media = new MessageMedia('image/jpeg', cleanBase64, 'photo.jpg');
        await client.sendMessage(to, media, { caption: message });
      } else if (imageUrl) {
        const media = await MessageMedia.fromUrl(imageUrl, { unsafeMime: true });
        await client.sendMessage(to, media, { caption: message });
      } else {
        // This now uses the client-level sendMessage, which is more robust
        await client.sendMessage(to, message);
      }

      logCallback(null, new Date(), to, start);
    } catch (err) {
      logCallback(err, new Date(), to, start);
      console.error(`Failed to send message to ${to}:`, err);
    }
    // --- END OF UPDATED SECTION ---

    const estRemainingMs = queueData.queue.length * MAX_DELAY_MS;
    const estRemainingSec = Math.round(estRemainingMs / 1000);

    console.log(`[Queue][${employeeId}] Sent message to ${to}. Queue length: ${queueData.queue.length}. Estimated time remaining: ${estRemainingSec}s`);

    const biasedRandom = Math.pow(Math.random(), 2); 
    const waitMs = MIN_DELAY_MS + biasedRandom * (MAX_DELAY_MS - MIN_DELAY_MS);
    await delay(waitMs);
  }

  queueData.running = false;
}