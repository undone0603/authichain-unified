# Threat Model

This threat model outlines the security considerations for the AuthiChain Unified platform — blockchain-based product authentication, NFT marketplace, business automation, subscription management, QR-code generation, supply-chain tracking, and revenue optimization.

## Assets

- **User Credentials**: Account login information, JWT session tokens, OAuth tokens (LinkedIn, YouTube, Twitter, Stripe Connect).
- **Blockchain Assets**: NFTs, $QRON token balances, smart-contract state on Polygon and BTC Ordinals.
- **Business Data**: Service orders, subscription records, product metadata, supply-chain events, lead/CRM data.
- **Payment Information**: Stripe and Paddle transaction identifiers, webhook signatures, customer billing state.
- **Secrets and Configuration**: API keys, private keys (Polygon), env vars across server, workers, and CI.

## Threat Actors

- **External Attackers**: Unauthenticated adversaries probing for application flaws.
- **Insider Threats**: Privileged users (admin role, founder cloner) acting maliciously or negligently.
- **Compromised Clients**: Browsers/devices infected with malware that hijacks sessions or wallets.
- **Automated Bots**: Credential stuffing, scraping, or DoS scripts.
- **Supply-Chain Adversaries**: Attackers exploiting vulnerabilities in npm packages, GitHub Actions, or Cloudflare Worker dependencies.

## Attack Surface

- **Web Application**: React/Vite SPA served from Cloudflare Workers + static assets (`dist/public`).
- **API Endpoints**: tRPC routes (`/api/trpc/*`) bundled into the Worker entry, plus `/api/oauth/callback` and `/webhooks/stripe`.
- **Smart Contracts**: ERC-20 and ERC-721 contracts on Polygon.
- **Server Infrastructure**: Cloudflare Workers (8 specialized), Supabase (Postgres), Cloudflare R2 (asset storage), Vercel (legacy serverless entry).
- **Authentication & Authorization**: JWT cookies, OAuth flows with LinkedIn/YouTube/Twitter, Stripe Connect.
- **Continuous Integration Pipeline**: GitHub Actions for build/deploy and scheduled jobs (gov-engine).
- **Third-Party Integrations**: Stripe, Paddle, HubSpot, OpenAI, Resend, Pinecone, Supabase.

## Potential Threats

- **Injection Attacks**: SQL injection via Drizzle (mitigated by parameterized template literals); command injection via untrusted input passed to shell.
- **Cross-Site Scripting (XSS)**: User-controlled content rendered without sanitization.
- **Cross-Site Request Forgery (CSRF)**: State-changing requests from a malicious site abusing session cookies.
- **Authentication Bypass**: Session-token forgery, replay, or fixation.
- **Privilege Escalation**: Regular users invoking admin tRPC procedures.
- **Smart Contract Vulnerabilities**: Reentrancy, integer overflow, missing access controls.
- **Denial of Service**: Excessive requests against tRPC endpoints or scheduled jobs.
- **Secret Leakage**: Accidental commit of API keys, private keys, or `.env` files.
- **Dependency Vulnerabilities**: Compromised or vulnerable npm packages.
- **Supply-Chain Compromise of CI**: Malicious GitHub Action consuming `GITHUB_TOKEN` with elevated scopes.

## Mitigations

- **Secure Coding**: Drizzle ORM with parameterized queries; tRPC input validation via Zod schemas; React's escape-by-default rendering.
- **Authentication & Authorization**: HTTP-only `Secure` `SameSite` cookies for sessions; admin procedures gated by role check on every call.
- **HTTPS Everywhere**: Cloudflare-managed TLS on all four custom domains.
- **CSRF Protection**: `SameSite=Lax` on session cookies; CORS preflight rejects requests without an Origin and never falls back to `*` with credentials.
- **Rate Limiting**: `express-rate-limit` on the legacy server entry; Cloudflare Workers rate-limiting on the edge.
- **Smart Contract Auditing**: Contracts derived from OpenZeppelin templates; audit before mainnet deploy.
- **Secret Management**: GitHub Actions secrets + Cloudflare Worker secret bindings. No `.env` ever committed (`.env` in `.gitignore`). gitleaks scan runs on every push.
- **Continuous Integration Security**: All workflows run with `permissions: contents: read` by default; broader scopes only granted where needed. Dependabot ignored entries for transitive-only pnpm overrides.
- **Dependency Management**: Dependabot weekly with patch auto-merge; major bumps gated for human review.
- **Logging and Monitoring**: Cloudflare Workers analytics + Supabase activity log table for the autonomous pipeline.
- **Incident Response**: SECURITY.md describes the private disclosure path via GitHub Security Advisories.

## Assumptions

- Users are responsible for protecting their own private keys and wallets.
- The platform relies on the security of Cloudflare, Supabase, and Polygon network.
- The CI/CD environment has restricted permissions; secrets are rotated when rotation triggers in `docs/SECURITY-REMEDIATION-CRITICAL.md` fire.

## Conclusion

By understanding the assets, adversaries, and attack vectors above, AuthiChain Unified can address risks proactively. Secure development practices, rigorous testing, automated scanning, dependency management, and operational controls together protect users and platform integrity.
