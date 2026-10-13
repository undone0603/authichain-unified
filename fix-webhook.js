const fs = require('fs');
const file = 'apps/qron-platform/src/app/api/stripe/webhook/route.ts';
let code = fs.readFileSync(file, 'utf8');

// Ensure we define the variables if they are missing
code = code.replace(
  /const profileResponse = await db\.select/,
  `const invoice = event.data.object as any;
    const amountPaid = invoice.amount_paid / 100;
    const subscriptionId = invoice.subscription;
    const profileResponse = await db.select`
);

fs.writeFileSync(file, code);
