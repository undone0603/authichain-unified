# AgentZ local voice + vision (operator-only)

This is an opt-in **internal sensory interface**, not a new autonomous release agent.

- **Voice:** AgentZ speaks its short operational recommendation through the local OS speech engine (macOS `say`, Linux `espeak`, Windows `System.Speech`). If no engine is installed, it prints the report without pretending to speak.
- **Vision:** An operator supplies a local PNG/JPEG/WebP screenshot; AgentZ sends it to an explicitly named vision-capable **loopback LM Studio model**. No third-party inference API, browser actions, image storage, or upload to AuthiChain.
- **Thinking:** The evidence evaluator uses deterministic fail-closed logic. Queued jobs cannot be interpreted as passing, and even a passing token preflight does not authorize a deployment. The vision model's interpretation is advisory and untrusted.
- **Optimization:** AgentZ prioritizes the next evidence-producing read-only diagnostic rather than repeating passing CI, dispatching releases, changing credentials, or making speculative claims.

## Commands

```bash
# Run from repository root; no additional Python dependencies for JSON diagnosis.
python -m agentz.operator_senses --evidence /path/to/redacted-status.json

# Speak the read-only recommendation when a local TTS engine exists.
python -m agentz.operator_senses --evidence /path/to/redacted-status.json --speak

# Opt-in screenshot interpretation by a locally running vision-capable model.
python -m agentz.operator_senses --image /path/to/redacted-screenshot.png \
  --model YOUR_INSTALLED_VISION_MODEL --endpoint http://127.0.0.1:1234/v1

# Offline regression tests.
python -m unittest agentz.tests.test_operator_senses -v
```

Minimal evidence file:

```json
{
  "run": {"status": "queued"},
  "job": {"status": "queued"},
  "markers": []
}
```

Do not include API keys, cookies, tokens, environment dumps, or personal information in evidence or screenshots. The tool does not inspect GitHub/Cloudflare directly, and **does not prove any live credential status** unless the operator supplies verified job evidence. It never merges, deploys, sends outreach, changes policies, or performs payments.

The existing `server/agents/browser-vision.ts` provides browser-based vision for other tasks. This new local path deliberately does **not** invoke its click/type/navigation tools. The operator can safely dogfood screenshots from that interface without granting this diagnostic write privileges.
