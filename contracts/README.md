# AuthiChain Smart Contracts

## Deployed on Polygon Mainnet (chain ID 137)

### AuthiChainNFT — Product Authentication NFT
- **Address:** `0x4da4D2675e52374639C9c954f4f653887A9972BE`
- **Name / Symbol:** AuthiChainProduct / ACPT
- **Standard:** ERC721 (URIStorage + Enumerable) + AccessControl + Pausable + ReentrancyGuard
- **Compiler:** Solidity 0.8.19
- **Deployed via:** thirdweb
- **IPFS source CID:** `QmbHvtSAhQHRXSFqD6sDyN32y8yoY3akn9QT2WXMoVNoe8`
- **Thirdweb metadata:** https://contract.thirdweb.com/metadata/137/0x4da4D2675e52374639C9c954f4f653887A9972BE
- **Source:** [`AuthiChainNFT.sol`](./AuthiChainNFT.sol)
- **ABI:** [`AuthiChainNFT.abi.json`](./AuthiChainNFT.abi.json)

**Roles:**
- `DEFAULT_ADMIN_ROLE` — grant/revoke other roles, verify manufacturers
- `MINTER_ROLE` — mint product NFTs
- `UPDATER_ROLE` — update product details, add supply-chain events
- `PAUSER_ROLE` — pause/unpause contract

**Key functions:**
- `mintProduct(to, productIdentifier, manufacturer, model, serialNumber, additionalDetails, uri)` — mints a new product NFT
- `addSupplyChainEvent(tokenId, eventType, location, notes)` — append supply-chain history
- `updateProductDetails(tokenId, model, serialNumber, additionalDetails, uri)` — update product info
- `deactivateProduct(tokenId)` — soft-delete
- `verifyManufacturer(manufacturer)` / `revokeManufacturer(manufacturer)`
- `getProductInfo(tokenId)` / `getSupplyChainHistory(tokenId)` / `getTokenIdByProductIdentifier(id)`

### $QRON Token
- **Address:** `0xAebfA6b08fb25b59748c93273aB8880e20FfE437`
- **Name / Symbol:** QRON / $QRON
- **Standard:** ERC20 (1,000,000,000 total supply, 18 decimals)

## Usage from mint-govchain-nfts.ts

The gov-engine pipeline uses these env vars (see `.github/workflows/gov-engine.yml`):
- `ALCHEMY_API_KEY` — Polygon RPC
- `WALLET_PRIVATE_KEY` — must hold `MINTER_ROLE` on AuthiChainNFT
- `CONTRACT_ADDRESS` — `0x4da4D2675e52374639C9c954f4f653887A9972BE`

The minting account must be granted `MINTER_ROLE` by the deployer before it can call `mintProduct`.
