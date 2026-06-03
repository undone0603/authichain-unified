const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const CITIES = [
  { city: "Paris", country: "FR", lat: 48.8566, lng: 2.3522 },
  { city: "New York", country: "US", lat: 40.7128, lng: -74.0060 },
  { city: "Tokyo", country: "JP", lat: 35.6762, lng: 139.6503 },
  { city: "Dubai", country: "AE", lat: 25.2048, lng: 55.2708 },
  { city: "London", country: "GB", lat: 51.5074, lng: -0.1278 },
  { city: "Milan", country: "IT", lat: 45.4642, lng: 9.1900 },
  { city: "Singapore", country: "SG", lat: 1.3521, lng: 103.8198 },
  { city: "Los Angeles", country: "US", lat: 34.0522, lng: -118.2437 },
  { city: "Berlin", country: "DE", lat: 52.5200, lng: 13.4050 },
  { city: "Shanghai", country: "CN", lat: 31.2304, lng: 121.4737 }
];

async function seedScanEvents() {
  console.log("🌱 Seeding Global Scan Events...");

  // 1. Get some QRONs
  const { data: qrons } = await supabase.from('qrons').select('id').limit(5);
  if (!qrons || qrons.length === 0) {
    console.error("❌ No QRONs found to link scans to.");
    return;
  }

  const events = [];
  for (let i = 0; i < 20; i++) {
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    events.push({
      qron_id: qrons[Math.floor(Math.random() * qrons.length)].id,
      user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      country: city.country,
      city: city.city,
      scanned_at: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString()
    });
  }

  const { error } = await supabase.from('scan_events').insert(events);
  if (error) {
    console.error("❌ Seeding failed:", error);
  } else {
    console.log(`✅ Successfully seeded ${events.length} scan events.`);
  }
}

seedScanEvents();
