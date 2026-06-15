/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL || '');

async function checkFlowTypes() {
  try {
    const constraint = await sql`
      SELECT pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conname = 'fee_flows_flow_type_check'
    `;
    console.log('Constraint definition:', constraint[0].pg_get_constraintdef);
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit();
  }
}

checkFlowTypes();
