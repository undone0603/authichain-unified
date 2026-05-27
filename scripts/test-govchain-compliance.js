const fetch = require('node-fetch');

const MOCK_COMPLIANCE_PAYLOAD = {
  registry: 'EUDAMED',
  action: 'VALIDATE_DEVICE',
  data: {
    udi_di: '05414135000018',
    manufacturer_srn: 'BE-MF-000000001',
    device_class: 'Class IIb',
    certificate_id: 'EU-CERT-999',
    timestamp: new Date().toISOString()
  }
};

async function testCompliance() {
  const url = process.env.GOVCHAIN_API_URL || 'http://localhost:3000/api/govchain-us';
  console.log(`Sending mock Medical Compliance payload to ${url}...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'mock_medical_key'
      },
      body: JSON.stringify(MOCK_COMPLIANCE_PAYLOAD)
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', data);
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testCompliance();
