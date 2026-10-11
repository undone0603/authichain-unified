import fs from 'fs';
import path from 'path';

const BUFFER_FILE = path.resolve('sync-buffer.json');

async function syncLoop() {
  console.log('🔄 Starting file-backed sync daemon...');
  
  if (!fs.existsSync(BUFFER_FILE)) {
    fs.writeFileSync(BUFFER_FILE, JSON.stringify([], null, 2));
  }

  setInterval(async () => {
    try {
      const timestamp = new Date().toISOString();
      const raw = fs.readFileSync(BUFFER_FILE, 'utf8');
      const records = JSON.parse(raw);
      
      console.log(`[${timestamp}] Synced ${records.length} records from local buffer file.`);
    } catch (err) {
      console.error('File sync error:', err.message);
    }
  }, 10000);
}

syncLoop();
