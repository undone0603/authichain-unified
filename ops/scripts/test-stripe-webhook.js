const fetch = require('node-fetch');

const MOCK_PAYLOAD = {
  id: 'evt_test_123',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_mock_123',
      customer: 'cus_test_mock_123',
      amount_total: 1000,
      currency: 'usd',
      status: 'complete',
      metadata: {
        userId: 'user_mock_123'
      }
    }
  }
};

async function testWebhook() {
  const url = process.env.STRIPE_WEBHOOK_URL || 'http://localhost:3000/api/stripe-webhook';
  console.log(`Sending mock Stripe payload to ${url}...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'mock_signature'
      },
      body: JSON.stringify(MOCK_PAYLOAD)
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', data);
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testWebhook();
