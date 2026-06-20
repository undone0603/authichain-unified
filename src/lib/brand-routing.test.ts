import { describe, it, expect } from 'vitest';
import { normalizeHost, resolveBrand, resolveRootRewrite } from './brand-routing';

describe('brand-routing', () => {
  describe('normalizeHost', () => {
    it('lowercases and strips the port', () => {
      expect(normalizeHost('App.AuthiChain.com:443')).toBe('app.authichain.com');
    });
  });

  describe('resolveBrand', () => {
    it('maps known marketing hosts', () => {
      expect(resolveBrand('authichain.com')).toBe('authichain');
      expect(resolveBrand('qron.space')).toBe('qron');
      expect(resolveBrand('govchain.us')).toBe('govchain');
      expect(resolveBrand('strainchain.io')).toBe('strainchain');
    });

    it('maps the app subdomain to the authichain brand for theming', () => {
      expect(resolveBrand('app.authichain.com')).toBe('authichain');
    });

    it('falls back to authichain for unknown hosts', () => {
      expect(resolveBrand('example.org')).toBe('authichain');
    });
  });

  describe('resolveRootRewrite', () => {
    it('routes the app subdomain root to the dashboard, NOT the marketing page', () => {
      // Regression: app.authichain.com previously rewrote "/" to /brand/authichain
      // (marketing), making the "Launch App" CTA loop back to marketing.
      expect(resolveRootRewrite('app.authichain.com')).toBe('/dashboard');
    });

    it('routes marketing hosts to their brand landing page', () => {
      expect(resolveRootRewrite('authichain.com')).toBe('/brand/authichain');
      expect(resolveRootRewrite('www.authichain.com')).toBe('/brand/authichain');
      expect(resolveRootRewrite('qron.space')).toBe('/brand/qron');
      expect(resolveRootRewrite('govchain.us')).toBe('/brand/govchain');
    });

    it('handles host headers with a port', () => {
      expect(resolveRootRewrite('app.authichain.com:443')).toBe('/dashboard');
    });

    it('passes through unknown hosts (no rewrite)', () => {
      expect(resolveRootRewrite('localhost')).toBeNull();
      expect(resolveRootRewrite('some-preview.vercel.app')).toBeNull();
    });
  });
});
