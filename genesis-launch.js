/**
 * GENESIS LAUNCHER
 * Hits the local automation endpoint to trigger the protocol's first autonomous cycle.
 */
async function triggerGenesis() {
  console.log('--- INITIATING GENESIS TRIGGER ---');
  try {
    const res = await fetch('http://localhost:3000/api/automation/cron', {
      headers: {
        'Authorization': 'Bearer ' + process.env.CRON_API_KEY
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log('✅ GENESIS SUCCESSFUL:', data.status);
      console.log('Timestamp:', data.timestamp);
    } else {
      const text = await res.text();
      console.error('❌ TRIGGER FAILED:', res.status, text);
    }
  } catch (err) {
    console.error('❌ NETWORK ERROR:', err.message);
  }
}

triggerGenesis();
