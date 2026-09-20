> Imported from Undone0603 sibling repo on 2026-09-20. **Legacy / non-live reference** — do not treat as current production architecture or pricing.

# QRON Starter v2

**Living QR Codes — Art meets utility. Create AI-generated scannable portals that captivate.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/undone0603/qron-starter-v2&project-name=qron-space&repository-name=qron-space&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,GROQ_API_KEY,FAL_KEY,NEXT_PUBLIC_NFT_CONTRACT_ADDRESS,NEXT_PUBLIC_THIRDWEB_CLIENT_ID&envDescription=API%20keys%20for%20QRON%20platform&envLink=https://github.com/undone0603/qron-starter-v2/blob/main/.env.example)

---

## Overview

QRON transforms ordinary QR codes into dynamic, AI-generated art pieces that remain fully scannable. This starter template provides everything you need to launch your own QRON platform in under 30 minutes.

### Features

- **11 Unique Modes**: Static, Stereographic, Kinetic, Holographic, Memory (NFT), Echo (Ultrasonic), Temporal, Reactive, Layered, Dimensional, and Living
- **AI-Powered Generation**: Fal.ai integration for instant artistic QR creation
- **Video QR Codes**: Runway ML integration for animated Kinetic mode
- **NFT Minting**: Thirdweb integration for on-chain Memory QRONs on Base
- **Ultrasonic Triggers**: Chirp.io integration for proximity-activated codes
- **Full Authentication**: Supabase Auth with social providers
- **Analytics Ready**: Plausible.io integration for privacy-friendly tracking
- **Enterprise Ready**: Tiered pricing architecture built-in

---

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Git installed
- Accounts on: [Vercel](https://vercel.com), [Supabase](https://supabase.com), [Fal.ai](https://fal.ai)

### 1. Clone & Deploy

Click the "Deploy with Vercel" button above, or manually:

```bash
# Clone the repository
git clone https://github.com/QRON-2026/qron-starter-v2.git
cd qron-starter-v2

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### 2. Configure Environment Variables

Edit `.env.local` with your API keys:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Fal.ai (required for AI generation)
FAL_KEY=your_fal_key

# Optional: Video, Ultrasonic, NFT
RUNWAY_API_KEY=your_runway_key
CHIRP_API_KEY=your_chirp_key
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_id
```

### 3. Set Up Database

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### 4. Run Locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your QRON instance.

---

## Project Structure

```
qron-starter-v2/
├── app/
│   ├── api/
│   │   ├── generate/      # AI QR generation endpoint
│   │   ├── video/         # Runway video generation
│   │   ├── ultrasonic/    # Chirp.io encoding
│   │   └── mint/          # NFT minting
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ModeSelector.tsx   # 11-mode selection UI
│   ├── QRGenerator.tsx    # Generation form
│   ├── QRDisplay.tsx      # Result display
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── Providers.tsx      # Context providers
├── lib/
│   ├── types.ts           # TypeScript definitions
│   ├── utils.ts           # Utility functions
│   └── supabase.ts        # Database client
├── supabase/
│   └── migrations/        # Database schema
└── public/                # Static assets
```

---

## QRON Modes Explained

| Mode | Description | Requirements |
|------|-------------|--------------|
| **Static** | AI-styled QR with custom aesthetics | Fal.ai |
| **Stereographic** | 3D depth effect viewable cross-eyed | Fal.ai |
| **Kinetic** | Animated video QR that loops | Fal.ai + Runway |
| **Holographic** | Iridescent color-shifting effect | Fal.ai |
| **Memory** | Mintable as NFT on Base blockchain | Fal.ai + Thirdweb |
| **Echo** | Ultrasonic proximity trigger | Fal.ai + Chirp.io |
| **Temporal** | Time-based evolving design | Fal.ai + Custom logic |
| **Reactive** | Environment-aware adaptive QR | Fal.ai + External APIs |
| **Layered** | Multi-composition complex design | Fal.ai |
| **Dimensional** | AR-ready spatial anchor | Fal.ai + AR SDKs |
| **Living** | Self-evolving AI-driven QR | Fal.ai + Agent loop |

---

## API Reference

### POST /api/generate

Generate a new QRON.

**Request Body:**
```json
{
  "targetUrl": "https://example.com",
  "mode": "static",
  "style": "cyberpunk",
  "prompt": "optional custom prompt"
}
```

**Response:**
```json
{
  "success": true,
  "qron": {
    "id": "qron_123...",
    "imageUrl": "https://...",
    "metadata": { ... }
  }
}
```

### POST /api/video

Generate animated video from static QRON (Kinetic mode).

### POST /api/mint

Mint QRON as NFT on Base network (Memory mode).

### POST /api/ultrasonic

Encode ultrasonic trigger (Echo mode).

---

## Deployment

### Vercel — Option A: One-Click (Recommended)

Click the **Deploy with Vercel** button at the top of this README. Vercel will prompt for env vars from `.env.example`.

Then add the `qron.space` domain in **Vercel → Project → Settings → Domains**.

### Vercel — Option B: Auto-deploy via GitHub Actions

The workflow at `.github/workflows/deploy.yml` deploys on every push to `main`.

**One-time setup:**
1. Get a Vercel token: [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create
2. Add it as a GitHub secret:
   ```bash
   gh secret set VERCEL_TOKEN --body "your-token-here" --repo undone0603/qron-starter-v2
   ```
3. Push any commit — deployment triggers automatically

### Self-Hosted

```bash
npm run build
npm run start
```

---

## Monetization

Built-in tier system supports:

- **Free**: 10 generations/month, Static mode only
- **Pro**: Unlimited generations, all modes except Enterprise — See live pricing at [authichain.com/pricing](https://authichain.com/pricing).
- **Enterprise** (Custom): API access, white-label, priority support

Affiliate system included with 30% revenue share.

---

## Customization

### Adding New Modes

1. Add mode to `lib/types.ts` `QRONMode` type
2. Add config to `components/ModeSelector.tsx` `MODES` array
3. Add prompt template to `app/api/generate/route.ts` `MODE_PROMPTS`
4. Implement any special logic needed

### Changing Styles

Edit `tailwind.config.ts` to customize the color scheme:

```ts
colors: {
  qron: {
    primary: '#your-color',
    secondary: '#your-color',
    // ...
  }
}
```

---

## Support

- Documentation: [docs.qron.xyz](https://docs.qron.xyz)
- Discord: [discord.gg/qron](https://discord.gg/qron)
- Twitter: [@QRONofficial](https://twitter.com/QRONofficial)

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

**Built with ❤️ for the QRON community**
