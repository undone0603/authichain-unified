--304bdb5abf2a10a992cbd3fe519ac6440c39aa16b9ecba1d9f00e709d1e9
Content-Disposition: form-data; name="index.js"


const BOT_TOKEN      = '***REMOVED***';
const TOKEN_CONTRACT = '0xAebfA6b08fb25b59748c93273aB8880e20FfE437';
const TG = (m, p) => fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${m}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});

const LINKS = {
  polygonscan: `https://polygonscan.com/token/${TOKEN_CONTRACT}`,
  uniswap:     `https://app.uniswap.org/swap?outputCurrency=${TOKEN_CONTRACT}&chain=polygon`,
  opensea:     'https://opensea.io/collection/voyage-bloom-myles-high',
  qron_space:  'https://qron.space',
  authichain:  'https://authichain.com',
  demo:        'https://authichain.com/demo-video',
  strainchain: 'https://strainchain.io',
};

async function handle(msg) {
  const chatId = msg?.chat?.id;
  const text   = (msg?.text||'').toLowerCase().trim();
  if (!chatId) return;

  const send = (t, opts={}) => TG('sendMessage', {chat_id:chatId, text:t, parse_mode:'Markdown', disable_web_page_preview:true, ...opts});

  if (text==='/start') {
    return send(`🟡 *Welcome to $QRON*

$QRON is the ecosystem token of the Authentic Economy — the truth layer for the physical world.

*Three platforms. One token.*
🔗 [AuthiChain](https://authichain.com) — blockchain product authentication
🎨 [QRON.space](https://qron.space) — AI QR code art
🌿 [StrainChain](https://strainchain.io) — cannabis supply chain

Commands:
/token — contract & chain info
/buy — how to get $QRON
/art — QRON AI QR art
/nft — NFT collection
/verify — verify a product
/ecosystem — full platform overview
/help — all commands`);
  }

  if (text==='/help') {
    return send(`*$QRON Bot Commands*

/start — welcome & overview
/token — contract address & chain
/buy — buy $QRON on Uniswap
/art — QRON AI QR art generator
/nft — Voyage Bloom NFT collection
/verify — verify product authenticity
/ecosystem — full ecosystem overview
/whitepaper — token utility & vision`);
  }

  if (text==='/token') {
    return send(`🔗 *$QRON Token*

*Contract:* \`${TOKEN_CONTRACT}\`
*Chain:* Polygon (MATIC)
*Standard:* ERC-20

🔍 [View on PolygonScan](${LINKS.polygonscan})
💱 [Trade on Uniswap](${LINKS.uniswap})

*Utility:*
• Pay for QRON AI QR art generation
• AuthiChain verification credits
• StrainChain batch certification
• NFT mint fee discounts
• Governance voting (roadmap)`);
  }

  if (text==='/buy') {
    return send(`💱 *Buy $QRON*

1. Get MATIC on Polygon network
2. Go to Uniswap: [Swap to $QRON](${LINKS.uniswap})
3. Paste contract: \`${TOKEN_CONTRACT}\`
4. Set slippage to 1-3%
5. Swap ✓

*Or:*
🔍 [PolygonScan token page](${LINKS.polygonscan})

_Always verify the contract address before buying._`);
  }

  if (text==='/art') {
    return send(`🎨 *QRON AI QR Art*

Turn any QR code into scannable blockchain-verified artwork.

*Three styles:*
🌿 Cannabis formations (StrainChain)
⚡ EV lightning automotive
💎 Luxury geometric patterns

*Every QRON code:*
• Scans with any smartphone
• Carries a blockchain certificate
• Verifies AUTHENTIC in 2.1 seconds
• Becomes a collectible NFT

🎨 [Create at QRON.space](${LINKS.qron_space})

Plans from *$9*. Commercial license included.`);
  }

  if (text==='/nft') {
    return send(`🖼 *Voyage Bloom × Myles High*

AuthiChain's flagship NFT collection on OpenSea.

*5 pieces* — cannabis QRON AI art
Each token is blockchain-authenticated with AuthiChain Protocol

🔗 [View Collection on OpenSea](${LINKS.opensea})
📄 [Verify on PolygonScan](${LINKS.polygonscan})

_Physical cannabis product → QRON AI QR art → NFT collectible_
_A new asset class born from a plant._`);
  }

  if (text==='/verify') {
    return send(`✅ *Verify a Product*

1. Find the QRON QR code on the product
2. Open your phone camera
3. Scan the QR code
4. See AUTHENTIC ✅ in 2.1 seconds

*Or verify by cert ID:*
[authichain.com/verify](https://authichain.com/verify)

Demo cert: \`AC-1829577CED8F6BFBB0BC667CDE33DF0E\`

*5-agent AI consensus:*
Guardian (35%) + Archivist (20%) + Sentinel (25%) + Scout (8%) + Arbiter (12%)`);
  }

  if (text==='/ecosystem') {
    return send(`🌐 *Authentic Economy Ecosystem*

*AuthiChain* — enterprise product authentication
• Blockchain NFT at manufacture
• $0.004/product lot
• EU DPP 2026 compliant
• [authichain.com](${LINKS.authichain})

*QRON* — AI QR art + authentication
• FLUX.1-dev + ControlNet pipeline
• Cannabis, automotive, luxury styles
• Every code = blockchain certificate
• [qron.space](${LINKS.qron_space})

*StrainChain* — cannabis supply chain
• COA hash + METRC sync
• Seed-to-sale blockchain
• [strainchain.io](${LINKS.strainchain})

*$QRON Token*
• Ecosystem payment layer
• Contract: \`${TOKEN_CONTRACT}\`
• Chain: Polygon`);
  }

  if (text==='/whitepaper') {
    return send(`📄 *$QRON Token Utility*

*Core thesis:*
Objects have authenticity.
People have authenticity reputation.
AI agents enforce authenticity.
$QRON powers the economy around it.

*Token utility (live + roadmap):*
✅ QRON AI QR art generation credits
✅ AuthiChain verification API credits
✅ StrainChain batch certification fees
🔜 NFT mint fee discounts
🔜 Governance voting
🔜 Staking for verification rewards
🔜 Brand partnership licensing

*Contract:* \`${TOKEN_CONTRACT}\`
*Chain:* Polygon
[PolygonScan →](${LINKS.polygonscan})`);
  }

  return send('Unknown command. Try /help');
}

export default {
  async fetch(req) {
    if (req.method !== 'POST') return new Response('$QRON Token Bot OK', {status:200});
    try {
      const body = await req.json();
      await handle(body?.message || body?.edited_message);
    } catch(e) {}
    return new Response('OK');
  }
};

--304bdb5abf2a10a992cbd3fe519ac6440c39aa16b9ecba1d9f00e709d1e9--
