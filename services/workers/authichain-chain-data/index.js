/**
 * authichain-chain-data v2.2 — Apr 9 2026
 * MIGRATED: api.polygonscan.com (v1 DEPRECATED) → api.etherscan.io/v2 (chainid=137)
 */

const TOKEN = '0xAebfA6b08fb25b59748c93273aB8880e20FfE437';
const NFT   = '0x4da4D2675e52374639C9c954f4f653887A9972BE';
const ESCAN_QRON = 'EXRH7JMZ8RV21ZQPVG9CHDR9TA4IKAGDSD';
const ESCAN_NFT  = 'ZP7IGREASZ15GCY478KDNQYKP5XHKWVPWI';
const ESCAN_SC   = '4KWEVSEIX2XBIM1AJB1KDKUQP7NKYWI4F9';
const RPC = 'https://polygon-bor-rpc.publicnode.com';

// ✅ FIXED: Etherscan V2 API (chainid=137 = Polygon)
const ESCAN_V2 = 'https://api.etherscan.io/v2/api?chainid=137';
const CORS = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};

async function rpcCall(to, data) {
  const r = await fetch(RPC, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({jsonrpc:'2.0',method:'eth_call',params:[{to,data},'latest'],id:1})
  });
  const d = await r.json();
  return d.result || '0x';
}

function decodeString(hex) {
  if(!hex || hex === '0x') return '';
  const h = hex.slice(2);
  const len = parseInt(h.slice(64,128),16);
  const bytes = [];
  for(let i=0;i<len;i++) bytes.push(parseInt(h.slice(128+i*2,130+i*2),16));
  return String.fromCharCode(...bytes);
}

async function getTokenData() {
  const [name,symbol,supply,decimals] = await Promise.all([
    rpcCall(TOKEN,'0x06fdde03'),
    rpcCall(TOKEN,'0x95d89b41'),
    rpcCall(TOKEN,'0x18160ddd'),
    rpcCall(TOKEN,'0x313ce567'),
  ]);
  const dec = parseInt(decimals,16) || 18;
  const supplyBig = BigInt('0x'+supply.slice(2)) / BigInt(10**dec);
  return {
    contract: TOKEN,
    name: decodeString(name),
    symbol: decodeString(symbol),
    decimals: dec,
    totalSupply: supplyBig.toString(),
    network: 'Polygon Mainnet',
    polygonscan: 'https://polygonscan.com/token/' + TOKEN,
  };
}

async function getNFTData() {
  const [name,symbol,supply] = await Promise.all([
    rpcCall(NFT,'0x06fdde03'),
    rpcCall(NFT,'0x95d89b41'),
    rpcCall(NFT,'0x18160ddd'),
  ]);
  return {
    contract: NFT,
    name: decodeString(name),
    symbol: decodeString(symbol),
    totalSupply: parseInt('0x'+supply.slice(2)),
    network: 'Polygon Mainnet',
    opensea: 'https://opensea.io/assets/matic/' + NFT,
  };
}

// ✅ FIXED: Etherscan V2 format
async function esV2(apiKey, module, action, extra = '') {
  const url = `${ESCAN_V2}&module=${module}&action=${action}&apikey=${apiKey}${extra}`;
  const r = await fetch(url);
  const d = await r.json();
  return d.status === '1' ? d.result : null;
}

async function getRecentTxs(contract, key, type) {
  try {
    const action = type === 'nft' ? 'tokennfttx' : 'tokentx';
    const result = await esV2(key, 'account', action, `&contractaddress=${contract}&page=1&offset=10&sort=desc`);
    return (result || []).slice(0, 5);
  } catch(e) { return []; }
}

async function getHolderCount(contract, key) {
  try {
    const result = await esV2(key, 'token', 'tokenholdercount', `&contractaddress=${contract}`);
    return result || 'N/A';
  } catch(e) { return 'N/A'; }
}

async function getGasPrice() {
  try {
    const result = await esV2(ESCAN_QRON, 'gastracker', 'gasoracle', '');
    return result;
  } catch(e) { return null; }
}

export default {
  async fetch(req) {
    if(req.method==='OPTIONS') return new Response(null,{status:204,headers:{...CORS,'Access-Control-Allow-Methods':'GET,OPTIONS'}});
    const url = new URL(req.url);
    const path = url.pathname;

    if(path==='/health') {
      const d = await esV2(ESCAN_QRON, 'stats', 'tokensupply', `&contractaddress=${TOKEN}`);
      return Response.json({
        status: d ? 'ok' : 'degraded',
        api: 'etherscan-v2',
        chainid: 137,
        qron_supply_raw: d,
        ts: new Date().toISOString()
      }, {headers:CORS});
    }

    if(path==='/token' || path==='/qron') {
      const [data, holders, txs] = await Promise.all([
        getTokenData(),
        getHolderCount(TOKEN, ESCAN_QRON),
        getRecentTxs(TOKEN, ESCAN_QRON, 'token'),
      ]);
      return Response.json({...data, holders, recentTxs: txs, timestamp: new Date().toISOString()}, {headers:CORS});
    }

    if(path==='/nft' || path==='/authichain-nft') {
      const [data, holders, txs] = await Promise.all([
        getNFTData(),
        getHolderCount(NFT, ESCAN_NFT),
        getRecentTxs(NFT, ESCAN_NFT, 'nft'),
      ]);
      return Response.json({...data, holders, recentTxs: txs, timestamp: new Date().toISOString()}, {headers:CORS});
    }

    if(path==='/gas') {
      const gas = await getGasPrice();
      return Response.json({gas, timestamp: new Date().toISOString()}, {headers:CORS});
    }

    if(path==='/all') {
      const [token, nft, gas] = await Promise.all([getTokenData(), getNFTData(), getGasPrice()]);
      return Response.json({token, nft, gas, timestamp: new Date().toISOString()}, {headers:CORS});
    }

    return Response.json({
      service: 'AuthiChain Blockchain Data API v2.2',
      note: 'Migrated to Etherscan V2 API (Apr 9 2026)',
      routes: ['/health', '/token', '/nft', '/gas', '/all'],
      network: 'Polygon Mainnet (chainid=137)',
      contracts: {token: TOKEN, nft: NFT}
    }, {headers:CORS});
  }
};
