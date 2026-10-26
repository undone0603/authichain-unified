// American Seal modes for Starter / Launch packs.
// Confirmed live Stripe price IDs (acct_1SXIyEGqTruSqV8T).
// Import into pack generator; meter by imageCount against generations quota or PER_IMAGE_METERED_PRICE_ID.

export interface PackMode {
  id: string;
  name: string;
  tier: "starter" | "launch";
  prompt: string;
  outputSpec: string;
  imageCount: number;
  stripePriceId?: string;
}

export const americanSealModes: PackMode[] = [
  {
    id: "embossed-leather-wallet",
    name: "Embossed Leather Wallet",
    tier: "starter",
    imageCount: 2,
    stripePriceId: "price_1UIoEVGqTruSqV8T61lp48wB", // Starter Pack $29 one-time
    prompt: "Premium product photography of American saddle-brown leather bifold wallet, deeply embossed QRON American Eagle Seal (American flag stars and stripes woven into QR matrix, golden bald eagle silhouette centered, MADE IN USA tooled border). Professional studio lighting, clean white background, iPhone nearby showing glowing green VERIFIED AUTHENTIC checkmark. Ultra high quality, 8k commercial advertising style.",
    outputSpec: "1 hero product shot + 1 detail crop of the embossed seal",
  },
  {
    id: "die-struck-metal-tool",
    name: "Die-Struck Metal Tool Seal",
    tier: "starter",
    imageCount: 2,
    stripePriceId: "price_1UIoEVGqTruSqV8T61lp48wB",
    prompt: "Stainless steel fixed-blade knife or multi-tool with die-struck metal QRON seal (golden eagle + American flag pattern integrated into QR matrix, raised metallic texture, MADE IN USA border). Macro product photography, neutral background, high contrast so QR remains scannable. Commercial advertising quality, 8k.",
    outputSpec: "1 product shot + 1 close-up of strike depth and QR detail",
  },
  {
    id: "holographic-foil-label",
    name: "Holographic Foil Label + AR",
    tier: "launch",
    imageCount: 3,
    stripePriceId: "price_1UJjzPGqTruSqV8TmhFSc8vh", // qron_launch_mo $19/mo (100 gens)
    prompt: "Craft beer or spirits bottle with holographic foil QRON label (flag stars/stripes shifting under light, golden eagle center, MADE IN USA). Side lighting to show iridescence. Companion AR mock: hands holding iPhone scanning the seal, phone screen displays holographic American bald eagle with spread wings, VERIFIED AUTHENTIC badge, blue and gold particles. Cinematic lighting, 8k.",
    outputSpec: "1 bottle label mock + 1 AR still + 1 short video prompt",
  },
  {
    id: "embroidered-apparel-patch",
    name: "Embroidered Apparel Patch",
    tier: "launch",
    imageCount: 2,
    stripePriceId: "price_1UJjzPGqTruSqV8TmhFSc8vh",
    prompt: "Denim jacket or work shirt with embroidered QRON seal patch on chest (flag QR matrix in thread, golden eagle silhouette, MADE IN USA). Lifestyle shot of maker wearing it plus flat-lay product photography. Warm patriotic red white blue palette, professional commercial quality, 8k.",
    outputSpec: "1 worn lifestyle + 1 flat-lay",
  },
  {
    id: "manufacturing-floor-hero",
    name: "Manufacturing Floor Hero",
    tier: "launch",
    imageCount: 2,
    stripePriceId: "price_1UJjzPGqTruSqV8TmhFSc8vh",
    prompt: "Modern American manufacturing facility interior. Worker in clean uniform holding tablet showing QRON verification dashboard. Foreground: products with patriotic QRON seals (flag-integrated QR + eagle) moving on conveyor. Large American flag on wall, MADE IN AMERICA signage. Bright industrial lighting, sense of pride and quality. Photorealistic documentary style, 8k.",
    outputSpec: "1 wide establishing + 1 tight on dashboard/product",
  },
  {
    id: "app-icon-scan-ui",
    name: "App Icon + Scan UI Pair",
    tier: "starter",
    imageCount: 2,
    stripePriceId: "price_1UIoEVGqTruSqV8T61lp48wB",
    prompt: "QRON app icon: square rounded corners, deep navy blue background, centered golden American bald eagle silhouette in profile, subtle lighter-blue QR code pattern behind, small American flag stars accent. Matching scan UI: camera frame locking on patriotic QRON seal, green check animation, AR eagle emerging. Flat design with subtle gradients, professional, 8k.",
    outputSpec: "1 icon (SVG-ready proportions) + 1 scan UI screenshot mock",
  },
];

export const PER_IMAGE_METERED_PRICE_ID = "price_1USKlxGqTruSqV8TWs3lZDw2"; // $0.05 metered
export const LAUNCH_MONTHLY_PRICE_ID = "price_1UJjzPGqTruSqV8TmhFSc8vh";
export const STARTER_PACK_PRICE_ID = "price_1UIoEVGqTruSqV8T61lp48wB";
