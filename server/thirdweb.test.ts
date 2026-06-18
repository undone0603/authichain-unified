import { describe, it, expect, vi } from 'vitest';
import {
  checkThirdwebConnection as getConnectionStatus,
  uploadImageToIPFS,
  uploadMetadataToIPFS,
  buildAuthCertificateMetadata,
  mintAuthenticationNFT,
  transferErc20,
  burnErc20,
} from './thirdweb';

describe('Thirdweb Service', () => {
  it('should return connection status', async () => {
    const status = await getConnectionStatus();
    expect(status).toHaveProperty('connected');
    expect(status).toHaveProperty('clientId');
  });

  it('should build auth certificate metadata correctly', () => {
    const data = {
      productName: 'Test Product',
      certificateNumber: '123',
      authenticatorId: 1,
      confidenceScore: 0.95,
      verificationDate: '2024-01-01'
    };
    const metadata = buildAuthCertificateMetadata(data);
    expect(metadata.name).toContain('AuthiChain Certificate');
    expect(metadata.attributes).toContainEqual(expect.objectContaining({
      trait_type: 'Certificate Number',
      value: '123'
    }));
  });

  // These might need mocks for actual integration testing without keys
  it('should have IPFS upload functions defined', () => {
    expect(uploadImageToIPFS).toBeDefined();
    expect(uploadMetadataToIPFS).toBeDefined();
  });

  it('should have NFT minting function defined', () => {
    expect(mintAuthenticationNFT).toBeDefined();
  });
});

// The ERC-20 rails move real treasury funds. They must refuse to act unless
// BOTH a token contract and a signing key are explicitly configured — never
// guessing a contract address or signing with an absent key. The test env sets
// neither QRON_TOKEN_ADDRESS nor BLOCKCHAIN_PRIVATE_KEY, so the guards trip
// before any network/SDK call.
describe('ERC-20 transfer guards', () => {
  it('refuses to transfer when no token address is configured', async () => {
    await expect(
      transferErc20({ to: '0x000000000000000000000000000000000000dEaD', amount: '5' })
    ).rejects.toThrow(/token address/i);
  });

  it('refuses to transfer when a token is given but no signing key is configured', async () => {
    await expect(
      transferErc20({
        to: '0x000000000000000000000000000000000000dEaD',
        amount: '5',
        tokenAddress: '0x1111111111111111111111111111111111111111',
      })
    ).rejects.toThrow(/private key/i);
  });

  it('burnErc20 inherits the same guard — refuses with no token configured', async () => {
    await expect(burnErc20({ amount: '5' })).rejects.toThrow(/token address/i);
  });
});
