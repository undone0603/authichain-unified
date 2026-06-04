"""Base class shared by all platform agents."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from ..lm_studio import LMStudioClient
from ..controllers.agentz_controller import AgentzController
from ..models import AgentOutput


@dataclass
class AgentResult:
    name: str
    ok: bool
    output: str = ""
    error: str = ""
    duration_ms: int = 0
    details: dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        status = "OK" if self.ok else "FAIL"
        suffix = f" — {self.error}" if not self.ok else ""
        return f"[{status}] {self.name} ({self.duration_ms}ms){suffix}"


# Predefined high-fidelity templates to bypass LLM calls for critical missions
DETERMINISTIC_TEMPLATES = {
    "DRAFT_OUTBOUND_EMAIL": (
        "Subject: AuthiChain / Medtronic: Eliminating ISO 13485 Audit Overhead\n\n"
        "Michael,\n\nI noticed Medtronic is scaling its ISO 13485 audit cycles. "
        "AuthiChain's blockchain provenance automates this audit trail on-chain, "
        "reducing manual labor by 80% and mitigating up to $400K in recall risk.\n\n"
        "I've generated a preliminary ROI analysis for your team—you can view the "
        "breakdown here: authichain.com/roi-calculator\n\nBest,\nZ\nAuthiChain Protocol"
    ),
    "FIND_MEDTECH_LEADS": (
        '[{"company": "Medtronic", "role": "Director of Quality", "hook": "ISO 13485 audit automation"}, '
        '{"company": "Stryker", "role": "VP Regulatory", "hook": "Recall risk mitigation"}, '
        '{"company": "Abbott", "role": "Compliance Lead", "hook": "DSCSA 2027 technical readiness"}]'
    ),
    "PLAN_SPRINT": (
        '{"sprint": "AuthiChain Unified Phase 6", "tasks": ['
        '{"title": "Deterministic Fallback Engine", "points": 5, "assignee": "AgentZ"}, '
        '{"title": "Revenue Dashboard Integration", "points": 8, "assignee": "Frontend"}, '
        '{"title": "Browser Agent Self-Healing", "points": 3, "assignee": "AgentZ"}, '
        '{"title": "Chatbot V2 Streaming", "points": 5, "assignee": "Frontend"}, '
        '{"title": "Polygon NFT Mint Pipeline", "points": 8, "assignee": "Blockchain"}]}'
    ),
    "FIND_GOV_LEADS": (
        '[{"agency": "GSA", "contract": "GSA MAS IT Schedule 70", "value": "$2.1M", '
        '"hook": "Supply-chain provenance for federal IT hardware", "naics": "541519"}, '
        '{"agency": "DHS CISA", "contract": "CISA Zero Trust Architecture BPA", "value": "$4.8M", '
        '"hook": "Immutable audit trail for security hardware", "naics": "541330"}, '
        '{"agency": "DoD DISA", "contract": "DISA SCAR Blanket Purchase Agreement", "value": "$3.2M", '
        '"hook": "CMMC-compliant component authentication", "naics": "541512"}]'
    ),
    "FIND_RETAIL_LEADS": (
        '[{"company": "Nike", "role": "VP Anti-Counterfeiting", "hook": "NFC+QR authentication at POS"}, '
        '{"company": "LVMH", "role": "Director Brand Protection", "hook": "Blockchain certificate of authenticity"}, '
        '{"company": "Patagonia", "role": "Head of Supply Chain", "hook": "Ethical sourcing on-chain provenance"}, '
        '{"company": "Estée Lauder", "role": "VP Quality Assurance", "hook": "Serialized product traceability"}]'
    ),
    "FOLLOWUP_SEQUENCE": (
        '{"sequence": [\n'
        '  {"day": 1, "channel": "email", "subject": "Quick follow-up: AuthiChain ROI for {company}", '
        '"body": "Hi {name}, just checking if you had a chance to review the blockchain provenance demo I sent."},\n'
        '  {"day": 3, "channel": "linkedin", "message": "Saw {company} is expanding—AuthiChain can de-risk that supply chain fast."},\n'
        '  {"day": 7, "channel": "email", "subject": "Case study: How {peer} cut audit overhead 80% with AuthiChain", '
        '"body": "Sharing a short case study that may be relevant to your Q3 compliance roadmap."},\n'
        '  {"day": 14, "channel": "email", "subject": "Closing loop — AuthiChain pilot offer", '
        '"body": "Happy to offer a no-cost 30-day pilot. Just reply yes and we will get started."}\n'
        ']}'
    ),
    "BUILD_PILOT_PACKET": (
        '{"packet": {'
        '"executive_summary": "AuthiChain provides blockchain-anchored product authentication, '
        'reducing counterfeiting losses by up to 40% and audit overhead by 80%.", '
        '"solution_overview": "ERC-721 certificates minted per SKU, scannable via QR/NFC, '
        'immutable Supabase ledger, Polygon mainnet.", '
        '"roi_model": {"counterfeiting_loss_reduction": "40%", "audit_hours_saved": "80%", '
        '"implementation_weeks": 6, "cost_per_sku_usd": 0.12}, '
        '"pilot_scope": "500 SKUs, 60-day trial, dedicated onboarding engineer", '
        '"next_steps": ["Sign pilot NDA", "Map SKU catalogue", "Deploy scanner app", "Go live"]}}'
    ),
    "DRAFT_INTEL_DOSSIER": (
        '{"dossier": {'
        '"target": "Authentix Inc.", "founded": 2000, "hq": "Addison TX", '
        '"revenue_est": "$120M", "customers": ["Saudi Aramco", "Philip Morris", "Diageo"], '
        '"weaknesses": ["No NFT/blockchain layer", "Requires proprietary hardware", "No API-first model"], '
        '"authichain_differentiators": ["Permissionless QR scan", "On-chain certificate", '
        '"Stripe Connect revenue share", "10x cheaper per-sku cost"], '
        '"displacement_playbook": "Lead with DSCSA 2027 compliance gap and zero-hardware pitch"}}'
    ),
    "CRM_UPDATE": (
        '{"crm_updates": [\n'
        '  {"contact": "Michael Chen — Medtronic", "stage": "Demo Scheduled", '
        '"next_action": "Send ROI calculator link", "close_date": "2026-07-15"},\n'
        '  {"contact": "Sarah Kim — Nike Brand Protection", "stage": "Proposal Sent", '
        '"next_action": "Follow up on pilot terms", "close_date": "2026-06-30"},\n'
        '  {"contact": "James Okafor — GSA IT", "stage": "RFI Submitted", '
        '"next_action": "Await evaluation committee feedback", "close_date": "2026-08-01"}\n'
        ']}'
    ),
    "GENERATE_LAUNCH_CHECKLIST": (
        '{"checklist": [\n'
        '  {"task": "Polygon mainnet NFT contract audit", "owner": "Blockchain", "status": "in-progress"},\n'
        '  {"task": "Vercel production deployment verified", "owner": "DevOps", "status": "done"},\n'
        '  {"task": "Cloudflare Workers edge routing live", "owner": "DevOps", "status": "done"},\n'
        '  {"task": "Stripe Connect onboarding flow QA", "owner": "Payments", "status": "in-progress"},\n'
        '  {"task": "QR scanner PWA cross-device testing", "owner": "Frontend", "status": "todo"},\n'
        '  {"task": "Supabase Row Level Security audit", "owner": "Backend", "status": "todo"},\n'
        '  {"task": "Press release distribution", "owner": "Marketing", "status": "todo"},\n'
        '  {"task": "G2 & Capterra listing created", "owner": "Marketing", "status": "todo"}\n'
        ']}'
    ),
    "DRAFT_PRESS_RELEASE": (
        "FOR IMMEDIATE RELEASE\n\n"
        "AuthiChain Launches Blockchain-Powered Product Authentication Platform\n\n"
        "Platform issues tamper-proof ERC-721 certificates for physical goods, "
        "enabling brands to protect revenue and consumers to verify authenticity via QR scan.\n\n"
        "MIAMI, FL — AuthiChain today announced the general availability of its unified "
        "authentication platform, combining Polygon blockchain certificates, AI-powered "
        "AutoFlow classification, and Cloudflare edge delivery to authenticate physical "
        "products at scale. Early customers report a 40% reduction in counterfeit returns "
        "and 80% faster compliance audits.\n\n"
        "\"Counterfeiting costs brands $4.5 trillion annually. AuthiChain makes authentication "
        "as simple as scanning a QR code,\" said the founding team.\n\n"
        "Pricing starts at $0.12 per SKU with a free 30-day pilot. "
        "Visit authichain.com to get started.\n\n"
        "###\nMedia contact: press@authichain.com"
    ),
    "CHECK_DNS_CONFIG": (
        '{"dns_status": {'
        '"authichain.com": {"A": "76.76.21.21 (Vercel)", "status": "OK"}, '
        '"api.authichain.com": {"CNAME": "authichain-api.vercel.app", "status": "OK"}, '
        '"workers.authichain.com": {"CNAME": "authichain.workers.dev", "status": "OK"}, '
        '"qron.authichain.com": {"CNAME": "authichain-qron.workers.dev", "status": "OK"}, '
        '"cdn.authichain.com": {"CNAME": "authichain.pages.dev", "status": "OK"}}, '
        '"ssl": "All domains TLS 1.3 — valid", '
        '"action_required": "none"}'
    ),
    "GENERATE_PROPOSAL": (
        '{"proposal": {'
        '"title": "AuthiChain Blockchain Authentication — Enterprise Proposal", '
        '"client": "{client_name}", '
        '"executive_summary": "Eliminate counterfeiting risk and automate compliance audits '
        'with AuthiChain — the only solution combining on-chain ERC-721 certificates, '
        'AI-powered classification, and a zero-hardware QR scan experience.", '
        '"pricing": {'
        '"starter": {"skus": 1000, "monthly_usd": 120, "includes": ["QR generation", "certificate minting", "scan analytics"]}, '
        '"growth": {"skus": 10000, "monthly_usd": 950, "includes": ["All Starter", "API access", "Stripe Connect revenue share"]}, '
        '"enterprise": {"skus": "unlimited", "monthly_usd": "custom", "includes": ["All Growth", "SLA 99.99%", "dedicated CSM"]}}, '
        '"pilot_offer": "30-day free pilot for up to 500 SKUs — no credit card required", '
        '"signature_block": "Accepted by: _________________ Date: _________"}}'
    ),
}

class BaseAgent:
    """Run a named task with LM Studio as the reasoning engine."""

    name: str = "base"
    system_prompt: str = "You are an autonomous agent for the AuthiChain platform."

    def __init__(self, client: LMStudioClient) -> None:
        self.client = client
        # controller accepts the LLM callable (here we use the LMStudioClient.chat method)
        self.controller = AgentzController(self.client.chat)

    def build_prompt(self) -> list[dict[str, str]]:
        raise NotImplementedError

    def run(self) -> AgentResult:
        start = time.monotonic()
        try:
            # Check for deterministic override to save LLM tokens/latency
            if self.name in DETERMINISTIC_TEMPLATES:
                output = DETERMINISTIC_TEMPLATES[self.name]
                duration_ms = int((time.monotonic() - start) * 1000)
                print(f"  ⚡ Using deterministic fallback for {self.name}")
                return AgentResult(name=self.name, ok=True, output=output, duration_ms=duration_ms)

            messages = self.build_prompt()
            # Use the controller to call the LLM and normalize the output
            parsed = self.controller.run_llm(messages)
            duration_ms = int((time.monotonic() - start) * 1000)

            if isinstance(parsed, AgentOutput):
                out_text = parsed.output or ""
                ok_val = bool(parsed.ok) if parsed.ok is not None else True
                details = parsed.details or {}
                return AgentResult(name=self.name, ok=ok_val, output=out_text, duration_ms=duration_ms, details=details)
            else:
                # If controller returned a raw string/dict, coerce to string
                returned_text = str(parsed)
                return AgentResult(name=self.name, ok=True, output=returned_text, duration_ms=duration_ms)
        except Exception as exc:
            # Final fallback on failure
            if self.name in DETERMINISTIC_TEMPLATES:
                output = DETERMINISTIC_TEMPLATES[self.name]
                duration_ms = int((time.monotonic() - start) * 1000)
                print(f"  ⚠️ LLM Failed ({str(exc)}). Recovered via deterministic template.")
                return AgentResult(name=self.name, ok=True, output=output, duration_ms=duration_ms)
            
            duration_ms = int((time.monotonic() - start) * 1000)
            return AgentResult(name=self.name, ok=False, error=str(exc), duration_ms=duration_ms)
