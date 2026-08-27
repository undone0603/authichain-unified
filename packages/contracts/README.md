# AuthiChain Smart Contracts (Polygon Mainnet, chain ID 137)

## 1. AuthiChainNFT — Product Authentication NFT

| | |
|---|---|
| **Address** | [`0x4da4D2675e52374639C9c954f4f653887A9972BE`](https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE) |
| **Name / Symbol** | AuthiChainProduct / ACPT |
| **Standard** | ERC721 (URIStorage + Enumerable) + AccessControl + Pausable + ReentrancyGuard |
| **Compiler** | Solidity 0.8.19 |
| **Deployed via** | thirdweb |
| **Deployer wallet** | [`0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d`](https://polygonscan.com/address/0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d) |
| **Deploy tx** | [`0xc13c04dab7342b81e6e65af399bf4ff6d5093e392029d4e5df37e97c418747e3`](https://polygonscan.com/tx/0xc13c04dab7342b81e6e65af399bf4ff6d5093e392029d4e5df37e97c418747e3) |
| **Deploy block** | 77,535,676 (Oct 11, 2025) |
| **Current supply** | 16 NFTs minted |
| **IPFS source CID** | `QmbHvtSAhQHRXSFqD6sDyN32y8yoY3akn9QT2WXMoVNoe8` |

**Files:** [`AuthiChainNFT.sol`](./AuthiChainNFT.sol) · [`AuthiChainNFT.abi.json`](./AuthiChainNFT.abi.json)

**Roles** (granted to deployer at construction):
- `DEFAULT_ADMIN_ROLE` — grant/revoke other roles, verify manufacturers
- `MINTER_ROLE` (keccak `9f2df0fe…`) — `mintProduct`
- `UPDATER_ROLE` (keccak `73e573f9…`) — update details, add supply-chain events
- `PAUSER_ROLE` (keccak `65d7a28e…`) — pause/unpause

**Gov-engine NFT minting setup** — the `mint-govchain-nfts.ts` script in `.github/workflows/gov-engine.yml` needs:
- `ALCHEMY_API_KEY` — Polygon RPC
- `WALLET_PRIVATE_KEY` — **must be the private key for `0xbad4e580…`** (the deployer) OR any wallet that has been granted `MINTER_ROLE` via `grantRole(MINTER_ROLE, address)`
- `CONTRACT_ADDRESS` — `0x4da4D2675e52374639C9c954f4f653887A9972BE`

---

## 2. $QRON — Token

| | |
|---|---|
| **Address** | [`0xAebfA6b08fb25b59748c93273aB8880e20FfE437`](https://polygonscan.com/token/0xAebfA6b08fb25b59748c93273aB8880e20FfE437) |
| **Name / Symbol** | QRON / $QRON |
| **Total supply** | 1,000,000,000 (18 decimals) |
| **Deployer wallet** | [`0x8df0057ffb210444b927511b2d416ad7854fb81e`](https://polygonscan.com/address/0x8df0057ffb210444b927511b2d416ad7854fb81e) (factory caller) |
| **Owner / tax address** | [`0xc0d26735fd9e868eacc60400ef3171fa4161177f`](https://polygonscan.com/address/0xc0d26735fd9e868eacc60400ef3171fa4161177f) |
| **Factory** | [`0x46be54bbe239de5a6280c715017c10fc0a323353`](https://polygonscan.com/address/0x46be54bbe239de5a6280c715017c10fc0a323353) — Smithii `ERC20TokenFactory` |
| **Deploy tx** | [`0x900e18687b41d325108792da4a46318cae09a3a8bd93aa87bc69de4eb323f213`](https://polygonscan.com/tx/0x900e18687b41d325108792da4a46318cae09a3a8bd93aa87bc69de4eb323f213) |
| **Deploy block** | 81,887,002 (Jan 20, 2026) |
| **Anti-bot plugin** | `0x291cd878f871a6a49dc360e3c1777bcc5458019d` |
| **Anti-whale plugin** | `0x54afc8ff7877847cc89c5bfce05fa52828c740e9` |

**Files:** [`QRON_ERC20Template.sol`](./QRON_ERC20Template.sol) · [`QRON_ERC20Template.abi.json`](./QRON_ERC20Template.abi.json)

**Features:** ERC20Burnable + Pausable + Ownable + Secured + Shallowed + tax fee (currently 0%) + blacklist + airdrop mode.

---

## Debunked: `0xc3143254997d48fdc9983d618fb2e10067673eb5`

The address referenced in Airtable's "Weekly Polygon Deployed Contracts Report" emails in the Notion Tasks Tracker is **not a real contract** on Polygon — it has zero bytecode. Those reports are populated by a mock-data Airtable automation; ignore them.
