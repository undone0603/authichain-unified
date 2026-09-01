# LLM Connection Debug Report

**Date:** 2026-08-31  
**Scope:** `agentz/core/llm.py` (LimitProofLLM waterfall), `agentz/core/credentials.py`, env files  
**Reproducer:** `agentz/scripts/debug_llm_hello.py`  
**Working dir:** `/home/zac/projects/authichain-unified` (`.venv`)

---

## Summary

Connection failures were primarily caused by **`LimitProofLLM._local_base_url()` omitting the `/v1` OpenAI-compatible suffix**, while `.env` points `LOCAL_MODEL_URL` at a live **Ollama** server (`http://localhost:11434`). ChatOpenAI then called `/chat/completions` (404) instead of `/v1/chat/completions` (200).

After restoring `/v1` append, `get_llm().invoke("Hello world")` **succeeds** via the `local-lmstudio` provider (actually talking to Ollama’s OpenAI-compatible API with `gemma2:2b`).

Secondary issues: no cloud LLM API keys in env, several langchain provider packages missing from `.venv`, LM Studio hosts unreachable, and confusing LOCAL_MODEL ↔ Ollama wiring.

---

## Step 1 — Environment & credentials

| Variable             | Process env | `.env`                                                    | `.env.local` |
| -------------------- | ----------- | --------------------------------------------------------- | ------------ |
| `OPENAI_API_KEY`     | NOT SET     | absent                                                    | absent       |
| `GEMINI_API_KEY`     | NOT SET     | absent                                                    | absent       |
| `OPENROUTER_API_KEY` | NOT SET     | absent                                                    | absent       |
| `CEREBRAS_API_KEY`   | NOT SET     | absent                                                    | absent       |
| `DEEPSEEK_API_KEY`   | NOT SET     | absent                                                    | absent       |
| `ANTHROPIC_API_KEY`  | NOT SET     | absent                                                    | absent       |
| `LOCAL_MODEL_URL`    | NOT SET     | **SET** `http...1434` (len=22) → `http://localhost:11434` | absent       |
| `LOCAL_MODEL_ID`     | NOT SET     | **SET** `gemm...2:2b` (len=9) → `gemma2:2b`               | absent       |
| `OLLAMA_HOST`        | NOT SET     | absent (code default `http://localhost:11434`)            | absent       |
| `OLLAMA_MODEL`       | NOT SET     | absent (code default `llama3.2`)                          | absent       |
| `OLLAMA_API_KEY`     | NOT SET     | absent                                                    | absent       |

Notes:

- `.env` also has Supabase keys (unrelated to LLM).
- `.env.local` has Vercel/Stripe/Resend tokens; **no LLM keys**.
- `credentials.py` maps LLM keys correctly (`openai_api_key` → `OPENAI_API_KEY`, etc.) and loads repo-root `.env` via dotenv — loading works; the values simply are not present.
- No cloud health endpoints were callable (no keys).

---

## Step 2 — Network & connectivity

| Target                                                   | Result                                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `LOCAL_MODEL_URL` = `http://localhost:11434/v1/models`   | **HTTP 200** — Ollama OpenAI-compat; models include `gemma2:2b`, `llama3.2:3b`, gemma4 variants |
| `http://localhost:11434/api/tags`                        | **HTTP 200** — native Ollama tags                                                               |
| `POST …/chat/completions` (**no** `/v1`)                 | **HTTP 404** `page not found`                                                                   |
| `POST …/v1/chat/completions` model=`gemma2:2b`           | **HTTP 200** — completion OK                                                                    |
| `http://192.168.254.10:1234` (LM Studio default in code) | **Connection refused**                                                                          |
| `http://localhost:1234/v1/models`                        | **Timeout** — LM Studio not listening locally                                                   |

**Conclusion:** Local inference available only via **Ollama on :11434**. LM Studio is down on both candidates.

---

## Step 3 — Code isolation & error mapping

### Waterfall order (`LimitProofLLM.providers`)

1. `local-lmstudio` → ChatOpenAI + `LOCAL_MODEL_URL` + `LOCAL_MODEL_ID`
2. `local-lmstudio-fallback` → ChatOpenAI + same base + `LOCAL_MODEL_ID_FALLBACK` (default `nvidia/nemotron-3-nano-4b`)
3. `local-ollama` → `ChatOllama` (or ChatOpenAI if remote + API key)
4. `gemini-2.0-flash`, `cerebras-llama3.1`, `openrouter-auto`, `deepseek-chat`, `gpt-4o`, `claude-3-5-sonnet`

### Root cause (primary)

```python
# Broken (pre-fix): returned http://localhost:11434
# Fixed: append /v1 when missing → http://localhost:11434/v1
```

`ChatOpenAI` posts to `{base_url}/chat/completions`. Without `/v1`, Ollama returns 404.  
Same requirement applies to LM Studio’s OpenAI-compatible server.

**Fix applied (low-risk):** restore `/v1` normalization in `agentz/core/llm.py` `_local_base_url()` (aligned with `services/agentz/core/llm.py`).

### Reproducer results (after fix)

```
local-lmstudio:            SUCCEEDED  (Hello world via Ollama OpenAI compat)
local-lmstudio-fallback:   FAILED     model 'nvidia/nemotron-3-nano-4b' not found (404)
local-ollama:              FAILED     ModuleNotFoundError: langchain_ollama
gemini-2.0-flash:          FAILED     ModuleNotFoundError: langchain_google_genai
cerebras-llama3.1:         FAILED     Missing Cerebras Key
openrouter-auto:           FAILED     Missing OpenRouter Key
deepseek-chat:             FAILED     Missing DeepSeek Key
gpt-4o:                    FAILED     Missing OpenAI Key
claude-3-5-sonnet:         FAILED     ModuleNotFoundError: langchain_anthropic

get_llm().invoke("Hello world"): WATERFALL SUCCEEDED
```

### Package gap

`requirements-agentz.txt` lists `langchain-ollama`, `langchain-google-genai`, etc., but `.venv` currently has **`langchain-openai` only** among those providers. Native Ollama / Gemini / Anthropic factories fail at import even when keys exist.

### Env / naming mismatch

- `LOCAL_MODEL_URL` is set to **Ollama’s** port, but consumed by providers named `local-lmstudio*`.
- After `/v1` fix this accidentally works (Ollama speaks OpenAI `/v1`).
- `LMStudioManager` still calls LM Studio-native `/api/v1/models/load|unload` on a base that may be Ollama — those management calls are wrong against Ollama.
- Default `OLLAMA_MODEL=llama3.2` may not match pulled tags (`llama3.2:3b`); prefer setting `OLLAMA_MODEL=gemma2:2b` (or the exact tag) when using the native path.

---

## Uncommitted diffs in `agentz/core/llm.py` — help or hurt?

| Change                                                                            | Verdict                                                                                                                              |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Default / `local-model` id → `LOCAL_MODEL_ID` / `gemma2:2b`                       | **Helps** — matches pulled Ollama model                                                                                              |
| Earlier WIP that **removed** `/v1` append (committed already vs `services/` copy) | **Hurt** — proven 404; **restored** in this debug pass                                                                               |
| Default host `http://192.168.254.10:1234`                                         | **Hurts** when env unset — host unreachable from this machine; mitigated because `.env` sets `LOCAL_MODEL_URL`                       |
| Prefer lmstudio providers before ollama                                           | **Mixed** — works only because LOCAL_MODEL_URL points at Ollama; hides broken `langchain_ollama` install and blurs provider identity |
| `max_retries=0`, timeout 120 on local ChatOpenAI                                  | Neutral / slightly stricter fail-fast                                                                                                |

`services/agentz/core/llm.py` still has the correct `/v1` append and older defaults (`localhost:1234`, mistral model id, ollama-first order). The two trees have **drifted**; treat `agentz/` as the runtime copy used by this repo layout.

---

## Root cause hypothesis (ranked)

1. **Confirmed:** Missing `/v1` on OpenAI-compatible `base_url` → 404 against Ollama (and would also break LM Studio).
2. **Confirmed:** No cloud provider API keys in `.env` / `.env.local` → all paid/free cloud tiers skip/fail.
3. **Confirmed:** LM Studio endpoints down → pure LM Studio path cannot work.
4. **Confirmed:** `.venv` missing `langchain-ollama` / `langchain_google_genai` / `langchain_anthropic` → native ollama + gemini + claude factories cannot run.
5. **Contributing:** `LOCAL_MODEL_URL` semantically overloaded (Ollama URL used as “LM Studio” base).

---

## Recommended fix (ordered)

1. **Keep** `_local_base_url()` `/v1` normalization (done).
2. **Clarify env:** either
   - set `LOCAL_MODEL_URL=http://localhost:11434/v1` intentionally and document that “lmstudio” providers mean “OpenAI-compat local”, **or**
   - point `LOCAL_MODEL_URL` at real LM Studio when available and set `OLLAMA_HOST` + `OLLAMA_MODEL=gemma2:2b` for the ollama provider; put ollama first when only Ollama is up.
3. **Install** missing deps into `.venv`:  
   `pip install langchain-ollama langchain-google-genai langchain-anthropic` (per `requirements-agentz.txt`).
4. **Set** `OLLAMA_MODEL` to an installed tag (`gemma2:2b` or `llama3.2:3b`).
5. **Set or remove** `LOCAL_MODEL_ID_FALLBACK` to a model that exists locally (current default `nvidia/nemotron-3-nano-4b` 404s on this Ollama).
6. **Optional:** detect Ollama vs LM Studio (e.g. probe `/api/tags` vs LM Studio management API) so management load/unload is not aimed at the wrong server.
7. **Sync** `services/agentz/core/llm.py` with `agentz/core/llm.py` to avoid dual-copy drift.
8. **Add cloud keys** only if cloud failover is required; not needed for local hello-world once `/v1` works.

---

## Evidence commands

```bash
# 404 without /v1 vs 200 with /v1
curl -sS -m 10 -X POST http://localhost:11434/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"gemma2:2b","messages":[{"role":"user","content":"hi"}],"max_tokens":5}'

curl -sS -m 60 -X POST http://localhost:11434/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"gemma2:2b","messages":[{"role":"user","content":"Say hi"}],"max_tokens":20}'

# Full waterfall reproducer
.venv/bin/python agentz/scripts/debug_llm_hello.py
```

---

## Status after this investigation

- **Primary bug fixed** in `agentz/core/llm.py` (`_local_base_url` appends `/v1`).
- **Reproducer added** at `agentz/scripts/debug_llm_hello.py`.
- **Hello-world waterfall:** succeeding against local Ollama via OpenAI-compat path.
- **Remaining tech debt:** dual llm.py copies, missing venv packages, no cloud keys, LM Studio down, provider naming vs `LOCAL_MODEL_URL` semantics.
