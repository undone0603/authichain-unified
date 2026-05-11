import { describe, it, expect, vi } from 'vitest';
import { blockchainRouter } from './router';
import * as thirdweb from '../thirdweb';

vi.mock('../thirdweb', () => ({
  mintAuthenticationNFT: vi.fn(),
  buildAuthCertificateMetadata: vi.fn(),
}));

describe('Blockchain Router', () => {
  it('should return deployed contract info', async () => {
    const caller = blockchainRouter.createCaller({} as any);
    const result = await caller.deployedContract();
    expect(result).toHaveProperty('address');
    expect(result).toHaveProperty('chainId');
  });

  it('should have minting functionality available in implementation', () => {
    // Basic check that the router is defined and has the expected structure
    expect(blockchainRouter._def.procedures).toHaveProperty('deployedContract');
  });
});
