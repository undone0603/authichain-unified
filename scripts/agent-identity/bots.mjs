// Public roster. Names and one-line roles only. No secrets.
export const ISSUER_SLUG = 'authichain-agent-issuer';
export const VALID_FROM = '2026-10-17T18:00:00Z';
export const VALID_UNTIL = '2027-01-17T18:00:00Z';
const b = (name, slug, role) => ({ name, slug, role });
export const BOTS = [
  b('Grok Bot', 'grok-bot', "Founder's assistant: coordinates the team and drafts work for review"),
  b('Collective Cloud', 'collective-cloud', 'Shared team workspace agent'),
  b('AuthiChain Admin', 'authichain-admin', 'Administration and account hygiene'),
  b('Revenue Closer', 'revenue-closer', 'Follows up on sales leads'),
  b('Projects Manager', 'projects-manager', 'Plans work and tracks the project board'),
  b('AE Rival', 'ae-rival', 'Competitor research'),
  b('AE Creative', 'ae-creative', 'Marketing creative drafts'),
  b('Overheard', 'overheard', 'Listens for public mentions and market signals'),
  b('Cloudflare Fleet Auditor', 'cloudflare-fleet-auditor', 'Reviews Cloudflare deploys and code changes'),
  b('Notion Librarian', 'notion-librarian', 'Keeps the Notion knowledge base organized'),
  b('dr eggbot', 'dr-eggbot', 'Diagnostics and troubleshooting'),
  b('Local Runner', 'local-runner', 'Runs local jobs and scripts'),
  b('Janitor', 'janitor', 'Cleans up stale files, branches and tasks'),
  b('AE Decision Advisor', 'ae-decision-advisor', 'Makes go/no-go calls on reviewed work'),
  b('Project Ops', 'project-ops', 'Operations support for projects'),
  b('AE Ops Watch', 'ae-ops-watch', 'Watches operations and uptime'),
  b('Store Pilot', 'store-pilot', 'Storefront and checkout operations'),
  b('AuthiChain Marketing', 'authichain-marketing', 'Marketing drafts and the send log'),
  b('AE Designer', 'ae-designer', 'Design and visual assets'),
  b('AuthiChain Research', 'authichain-research', 'Research and wording checks'),
  b('CF Deploy', 'cf-deploy', 'Prepares and runs Cloudflare deploys'),
  b('AE Fleet Watch', 'ae-fleet-watch', 'Monitors the bot fleet'),
  b('Bankz', 'bankz', 'Finance tracking'),
];
