// Public roster. Names and one-line roles only. No secrets.
export const ISSUER_SLUG = 'authichain-agent-issuer';
export const VALID_FROM = '2026-10-17T18:00:00Z';
export const VALID_UNTIL = '2027-01-17T18:00:00Z';
const b = (name, slug, role) => ({ name, slug, role });
export const BOTS = [
  b('Grok Bot', 'grok-bot', "Drafts X posts for review and reports to AuthiChain Marketing"),
  b('Collective Cloud', 'collective-cloud', 'Makes community maps'),
  b('AuthiChain Admin', 'authichain-admin', 'Handles paperwork, deadlines and records'),
  b('Revenue Closer', 'revenue-closer', 'Works on StorePilot revenue'),
  b('Projects Manager', 'projects-manager', 'Plans work and tracks the project board'),
  b('AE Rival', 'ae-rival', 'Competitor research'),
  b('AE Creative', 'ae-creative', 'AI agent on the AuthiChain team (role description pending)'),
  b('Overheard', 'overheard', 'Watches public mentions'),
  b('Cloudflare Fleet Auditor', 'cloudflare-fleet-auditor', 'Read-only health checks and reviews of Cloudflare deploys'),
  b('Notion Librarian', 'notion-librarian', 'Keeps the Notion knowledge base organized'),
  b('dr eggbot', 'dr-eggbot', 'Designs Grok Bots'),
  b('Local Runner', 'local-runner', 'Runs local jobs and scripts'),
  b('Janitor', 'janitor', 'AI agent on the AuthiChain team (role description pending)'),
  b('AE Decision Advisor', 'ae-decision-advisor', 'Makes go/no-go calls on reviewed work'),
  b('Project Ops', 'project-ops', 'AI agent on the AuthiChain team (role description pending)'),
  b('AE Ops Watch', 'ae-ops-watch', 'AI agent on the AuthiChain team (role description pending)'),
  b('Store Pilot', 'store-pilot', 'Works on StorePilot revenue'),
  b('AuthiChain Marketing', 'authichain-marketing', 'Marketing drafts and the send log'),
  b('AE Designer', 'ae-designer', 'Design and visual assets'),
  b('AuthiChain Research', 'authichain-research', 'Research and wording checks'),
  b('CF Deploy', 'cf-deploy', 'Prepares and runs Cloudflare deploys'),
  b('AE Fleet Watch', 'ae-fleet-watch', 'Read-only morning check on the bot fleet'),
  b('Bankz', 'bankz', 'Keeps the evidence bank'),
];
