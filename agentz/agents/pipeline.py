"""All platform agents - mirrors server/jobs/task-runner.ts task kinds."""

from __future__ import annotations

from .base import BaseAgent


class LeadFinderGovAgent(BaseAgent):
    name = "FIND_GOV_LEADS"
    system_prompt = "You are a government-sector B2B lead intelligence agent for AuthiChain."

    def build_prompt(self):
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": (
                "Identify 5 high-value U.S. federal or state government prospects for AuthiChain's "
                "blockchain authentication platform. Focus on CBP, DHS, FDA, DoD supply-chain offices. "
                "For each, provide: agency, relevant program, estimated budget cycle, and a 1-sentence "
                "outreach hook. Return JSON array."
            )},
        ]


class LeadFinderRetailAgent(BaseAgent):
    name = "FIND_RETAIL_LEADS"
    system_prompt = "You are a retail & e-commerce B2B lead intelligence agent for AuthiChain."

    def build_prompt(self):
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": (
                "Identify 5 high-value retail brands (luxury, pharma, electronics) that need product "
                "authentication. For each, provide: company, decision-maker title, pain point, and a "
                "1-sentence outreach hook. Return JSON array."
            )},
        ]


class DraftOutboundEmailAgent(BaseAgent):
    name = "DRAFT_OUTBOUND_EMAIL"
    system_prompt = "You are an expert B2B copywriter specialising in anti-counterfeiting SaaS."

    def build_prompt(self):
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": (
                "Draft a cold outreach email for AuthiChain targeting a VP of Supply Chain at a luxury "
                "goods company. Subject line + 4-sentence body. Emphasise QR blockchain certificates, "
                "NFT provenance, and $49/mo entry plan. End with a soft CTA for a 15-min demo."
            )},
        ]


class FollowupSequenceAgent(BaseAgent):
    name = "FOLLOWUP_SEQUENCE"
    system_prompt = "You are a sales automation specialist."

    def build_prompt(self):
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": (
                "Write a 3-touch follow-up email sequence (Day 3, Day 7, Day 14) for an AuthiChain "
                "prospect who opened the initial cold email but did not reply. Each email should be "
                "under 80 words. Return as JSON with keys day, subject, body."
            )},
        ]


class BuildPilotPacketAgent(BaseAgent):
    name = "BUILD_PILOT_PACKET"
    system_prompt = "You are an enterprise sales engineer."

    def build_prompt(self):
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": (
                "Create an outline for a 90-day AuthiChain pilot packet for a mid-market pharmaceutical "
                "company. Include: success metrics, integration steps, go-live checklist, and ROI model "
                "assumptions. Return as structured JSON."
            )},
        ]


class DraftIntelDossierAgent(BaseAgent):
    name = "DRAFT_INTEL_DOSSIER"
    system_prompt = "You are a competitive intelligence analyst."

    def build_prompt(self):
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": (
                "Produce a competitive intelligence brief comparing AuthiChain's blockchain certificate "
                "platform against Authena, Chronicled, and IBM Food Trust. Dimensions: pricing, "
                "tech stack, target market, differentiation. Return JSON."
            )},
        ]


class CrmUpdateAgent(BaseAgent):
    name = "CRM_UPDATE"
    system_prompt = "You are a CRM data hygiene specialist."

    def build_prompt(self):
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": (
                "Generate a CRM update report for 3 mock AuthiChain deals: "
                "(1) LVMH pilot - stalled at legal review; "
                "(2) Pfizer POC - demo scheduled next week; "
                "(3) Walmart pilot - contract sent, awaiting signature. "
                "For each, suggest the next best action and a follow-up date. Return JSON."
            )},
        ]


class GenerateLaunchChecklistAgent(BaseAgent):
    name = "GENERATE_LAUNCH_CHECKLIST"
    system_prompt = "You are a SaaS launch manager."

    def build_prompt(self):
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": (
                "Generate a production launch checklist for AuthiChain's new QR blockchain "
                "certificate feature. Categories: infrastructure, security, legal, marketing, "
                "support. Return as JSON checklist with done=false for each item."
            )},
        ]


class DraftPressReleaseAgent(BaseAgent):
    name = "DRAFT_PRESS_RELEASE"
    system_prompt = "You are a PR specialist for blockchain/Web3 startups."

    def build_prompt(self):
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": (
                "Draft a 300-word press release announcing AuthiChain's partnership with a "
                "Fortune 500 pharmaceutical company to deploy blockchain product authentication "
                "across their global supply chain. Include quotes from both sides. AP style."
            )},
        ]


class CheckDnsConfigAgent(BaseAgent):
    name = "CHECK_DNS_CONFIG"
    system_prompt = "You are a DevOps infrastructure engineer."

    def build_prompt(self):
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": (
                "Produce a DNS health-check report for the authichain.com domain. List the expected "
                "DNS records (A, CNAME, MX, TXT/SPF, DKIM, DMARC) for a Vercel-hosted SaaS with "
                "Cloudflare proxy, SendGrid email, and a subdomain for the API. Return JSON."
            )},
        ]


class PlanSprintAgent(BaseAgent):
    name = "PLAN_SPRINT"
    system_prompt = "You are a senior software engineering manager."

    def build_prompt(self):
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": (
                "Create a 2-week sprint plan for the AuthiChain dev team. "
                "Focus areas: LM Studio local-AI integration, Python agentz CLI, "
                "Cloudflare Workers stability, and Supabase migration cleanup. "
                "Return JSON with story points, assignee roles, and acceptance criteria."
            )},
        ]


class GenerateProposalAgent(BaseAgent):
    name = "GENERATE_PROPOSAL"
    system_prompt = "You are a senior solutions consultant."

    def build_prompt(self):
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": (
                "Generate a 1-page executive proposal for AuthiChain's $799/mo Enterprise plan "
                "targeting a luxury goods conglomerate. Include: problem statement, solution summary, "
                "ROI calculation (assume 5% counterfeit reduction on $10M revenue), pricing, and "
                "next steps. Return as structured JSON."
            )},
        ]


# Registry - every agent class that power_launch_all will run
ALL_AGENTS: list[type[BaseAgent]] = [
    LeadFinderGovAgent,
    LeadFinderRetailAgent,
    DraftOutboundEmailAgent,
    FollowupSequenceAgent,
    BuildPilotPacketAgent,
    DraftIntelDossierAgent,
    CrmUpdateAgent,
    GenerateLaunchChecklistAgent,
    DraftPressReleaseAgent,
    CheckDnsConfigAgent,
    PlanSprintAgent,
    GenerateProposalAgent,
]
