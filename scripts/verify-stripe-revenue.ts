import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import Stripe from 'stripe';

async function verifyStripePayments() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('❌ STRIPE_SECRET_KEY not found in environment.');
    process.exit(1);
  }

  const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' as any });

  console.log('🔍 [Stripe] Verifying Recent Autonomous Revenue...');

  try {
    // 1. Check for recent charges (last 24 hours)
    const charges = await stripe.charges.list({
      limit: 10,
    });

    console.log(`\n📊 Recent Charges: ${charges.data.length}`);
    
    if (charges.data.length > 0) {
      charges.data.forEach(c => {
        console.log(`  ✅ Charge: $${(c.amount / 100).toFixed(2)} | Status: ${c.status} | Customer: ${c.customer || 'Guest'}`);
      });
    } else {
      console.log('  ⚠️ No charges found in the recent batch.');
    }

    // 2. Check for recent Payment Intents
    const intents = await stripe.paymentIntents.list({
      limit: 10,
    });

    const activeIntents = intents.data.filter(i => i.status === 'succeeded');
    console.log(`\n📊 Succeeded Payment Intents: ${activeIntents.length}`);
    
    activeIntents.forEach(i => {
       console.log(`  💰 Intent: $${(i.amount / 100).toFixed(2)} | ID: ${i.id}`);
    });

    // 3. Summary
    const totalSucceeded = activeIntents.reduce((acc, i) => acc + (i.amount / 100), 0);
    console.log(`\n🏁 [VERIFICATION] Total Live Revenue Verified: $${totalSucceeded.toLocaleString()}`);

  } catch (err) {
    console.error('❌ Stripe API Error:', err instanceof Error ? err.message : String(err));
  }
}

verifyStripePayments();
