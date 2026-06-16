require('dotenv/config');
    const postgres = require('postgres');
    
     console.log("DEBUG: Using DATABASE_URL:", process.env.DATABASE_URL);
    
     const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 5 });
    
     sql`SELECT 1`
      .then(() => { console.log('SUCCESS: Connected to Database'); process.exit(0); })
      .catch(e => { console.error('FAILURE: Connection failed', e); process.exit(1); });
