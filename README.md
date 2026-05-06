# qron-platform

A Next.js application with a Cloudflare Edge Worker and Drizzle ORM.

## Ecosystem & Multi-Domain Architecture

The QRON platform operates as a unified codebase serving four distinct branded experiences via Next.js Middleware.

- **qron.space**: Creative Studio & AI QR Art Generator.
- **authichain.com**: Enterprise Authentication Protocol & API Key Management.
- **govchain.us**: Ecosystem Governance, $QRON Staking, and DAO Voting.
- **strainchain.io**: Industrial Provenance & Digital Product Passports (DPP).

### Routing Logic
Traffic is routed based on the `Host` header. Shared application routes (like `/dashboard`, `/login`, and `/api`) remain unified across all domains, while the root path (`/`) serves the brand-specific landing page.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org) (App Router)
- **Database**: [Drizzle ORM](https://orm.drizzle.team) with PostgreSQL
- **Edge Runtime**: Cloudflare Workers
- **Styling**: Tailwind CSS

## Getting Started

1.  **Setup Environment**:
    ```bash
    cp .env.example .env
    ```
    Fill in your database and Cloudflare credentials.

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

4.  **Edge Worker**:
    The edge worker is located at `src/edge.ts` and can be managed via `wrangler.toml`.

## Database Management

- `npm run db:generate`: Generate migrations.
- `npm run db:push`: Push schema changes to the database.
- `npm run db:studio`: Open Drizzle Studio.

## Code Quality

- `npm run lint`: Run ESLint.
- `npm run format`: Format code with Prettier.

## Legal & Intellectual Property

### Licensing
This project is licensed under the **AuthiChain Proprietary License**. See `LICENSE.md` for full terms. Unauthorized reproduction, distribution, or reverse engineering of the AuthiChain Protocol or its multi-domain routing architecture is strictly prohibited.

### Privacy & Security
- **Privacy Policy**: Accessible at `/privacy`.
- **Terms of Service**: Accessible at `/terms`.
- **Security Disclosure**: See `SECURITY.md` for our vulnerability reporting process.

### Copyright
Copyright (c) 2026 AuthiChain Inc. All rights reserved. The QRON logo, AuthiChain Protocol branding, and "Living Portal" technology are trademarks of AuthiChain Inc.

