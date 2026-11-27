# AgentZ shadow log: hackathon sign-ups (2026-11-22)

Operator: Claude Code (Claude in Chrome). Observer: AgentZ (training shadow, read-only).
Owner authorization: "execute all sign ups and form submissions with claude in chrome".

## Steps
1. Devpost / Codegeist: Join hackathon -> secure.devpost.com register. Newsletter box unticked.
   Sign up with GitHub -> GitHub login -> Continue with Google -> owner Gmail
   (scopes openid/email/profile, redirect github.com) -> GitHub 2FA -> More options -> GitHub Mobile.
   - Number shown (44) timed out; "Retry GitHub Mobile" gave 43; owner approved on phone.
   - Result: existing Devpost account `undone0603` ("Welcome back!"), landed on /register.
2. Atlassian: id.atlassian.com/signup -> Google -> owner Gmail (openid/email/profile)
   -> home.atlassian.com. No Jira/Confluence site created.
3. Codegeist register form filled: Working solo; referral Devpost > Devpost.com; Atlassian dev
   account Yes; AI experience High; Atlassian/Forge experience Low; goal Competition; prior
   Codegeist No; Atlassian marketing unticked. Eligibility + Official Rules boxes left for owner.
4. Cognizant Open Agentic Web Challenge: already registered on `undone0603` (no action).
5. ETHGlobal Agentic Markets: login is email magic link only. Sent to owner Gmail.
   Waiting for owner to click the link / enter the code (operator never types codes).

## Lessons for AgentZ
- Extension permissions: screenshots are denied on secure.devpost.com, github.com and
  accounts.google.com, but find/read_page/click-by-ref work. Navigate by element refs
  and confirm progress with tabs_context URLs.
- GitHub Mobile 2FA requests expire after about 1 min. Poll the 2FA page; when it says
  "timed out", click Retry and post the new number at once. Owner wants polling, not "done" replies.
- Coordinates go stale after SSO or layout changes; prefer refs from find().
- Before registering, check for an existing registration ("You're registered for this hackathon").
- Rules acceptance is an owner decision: read /rules, summarize deadline / eligibility /
  deliverables / IP+publicity / arbitration, and tick boxes only after an explicit yes.
- ETHGlobal allows an existing product if one new feature is built during the event
  (event page text), so AuthiChain x402 work can be reused with a new feature.

## Outcome (end of session)
- Codegeist 2026: REGISTERED after owner "yes" to the 5-line rules summary. On re-entry, the form kept earlier answers (verify by screenshot before submitting).
- ETHGlobal: owner clicked the emailed link; the operator never touched it. Hacker application page 1 saved (the profile had already pre-filled fields; typing into them DOUBLED the values, so always select all before typing). Page 2 (irreversible track choice, ETH stake, sponsor data sharing) is on HOLD by owner decision.
- Owner decisions: individual entrant; ETHGlobal held; open-source boundary = thin clients open, core closed.

## Lessons (added)
- Look for pre-filled profile values before typing; use select-all + type.
- Separate reversible steps (registration) from binding ones (stake, irreversible track, data sharing) and surface the binding ones before acting.
- Before scaling up, assess going beyond what's needed: IP ownership vs entrant type, open-source exposure, stake forfeiture, opportunity cost.
- The tab group can vanish mid-flow (user closes or moves tabs). Recreate it with createIfEmpty and re-check form state.
