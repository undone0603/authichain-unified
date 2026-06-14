import { describe, it, expect, vi } from 'vitest';
import {
  checkThirdwebConnection,
  uploadImageToIPFS,
  uploadMetadataToIPFS,
  buildAuthCertificateMetadata,
  mintAuthenticationNFT
} from './thirdweb';

describe('Thirdweb Service', () => {
  it('should return connection status', async () => {
    const status = await checkThirdwebConnection();
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
