const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL);

async function check() {
  const columns = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'qr_codes'
  `;
  console.log("QR Codes Columns:", columns.map(c => c.column_name));

  const scans = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'qr_scan_events'
  `;
  console.log("Scan Events Columns:", scans.map(c => c.column_name));
  
  process.exit();
}

check();
