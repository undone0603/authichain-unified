# AuthiChain Reliability Architecture
**Standard:** Industrial-grade cascading fallbacks and autonomous self-healing.

## 1. Cascading LLM Gateway
All AI operations (Vision, Classification, Content) route through a central gateway with the following logic:
- **Priority 1:** Forge API (`forge.manus.im`) — Utilizes institutional quotas.
- **Priority 2:** OpenAI Native API — Direct fallback if Forge is unreachable.
- **Retry Logic:** 2 attempts per endpoint with exponential backoff (500ms, 1000ms).
- **Timeouts:** Hard 30s timeout per request to prevent hung processes.

## 2. ProductDNA™ (Vision) Resiliency
- **Defensive Parsing:** If the LLM returns malformed JSON, a regex-based extractor attempts to recover the `result` and `confidence`.
- **Safety Net:** If all analysis fails, the system returns a status of `"Manual Review Required"` instead of erroring, ensuring the consumer verification flow remains unbroken.

## 3. BrandVoice™ (Audio) Resiliency
- **Provider Fallback:** Cascades from Forge TTS to OpenAI TTS.
- **Default Asset:** If TTS generation fails entirely, the system serves a pre-recorded `"default-verification-story.mp3"`. Consumers always hear a response.

## 4. METRC Bridge (Compliance) Failover
- **State Failover:** Simulates Primary and Backup endpoints for state-level API access.
- **Reliable Sync:** 3-attempt retry loop per sync event.
- **Safe Exit:** Returns empty arrays on failure to allow background cron jobs to complete without halting the entire pipeline.

## 5. Financial Integrity (Stripe Connect)
- **Idempotency:** Every vendor provisioning and checkout operation uses a stable `idempotencyKey` based on the unique operation and User ID.
- **Impact:** Prevents duplicate charges and redundant connected account creation during network jitter.

## 6. Chaos Testing
- **Script:** `scripts/chaos-test-truth-layer.ts`
- **Purpose:** Intentionally breaks primary endpoints to verify that the cascading logic triggers correctly. This script should be run before any major production deployment.
