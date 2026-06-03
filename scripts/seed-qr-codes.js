const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedQRCodes() {
  console.log("🌱 Seeding QRONs...");

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || '00000000-0000-0000-0000-000000000000';

  const codes = [];
  const brands = ["Aethelgard", "StrainChain", "GovChain", "LVMH", "Rolex"];
  
  for (const brand of brands) {
    codes.push({
      user_id: userId,
      name: `${brand} Identity Anchor`,
      target_url: `https://authichain.com/p/SERIAL-${brand.toUpperCase()}-2026`,
      short_code: Math.random().toString(36).substring(7).toUpperCase(),
      scan_count: Math.floor(Math.random() * 100),
      mode: 'living',
      is_demo: false,
      metadata: { brand, vertical: "Luxury" }
    });
  }

  const { error } = await supabase.from('qrons').insert(codes);
  if (error) {
    console.error("❌ Seeding failed:", error);
  } else {
    console.log(`✅ Successfully seeded ${codes.length} QRONs.`);
  }
}

seedQRCodes();
