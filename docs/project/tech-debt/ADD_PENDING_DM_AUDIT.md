# Audit: `add_pending_dm`

**Date:** 2026-08-31  
**Scope:** Read-only audit of `add_pending_dm` and its callers. No production code was modified by this audit.  
**Canonical package:** `/home/zac/projects/authichain-unified/agentz/` (installed via `pyproject.toml` `[tool.setuptools.packages.find] include = ["agentz*"]`).  
**Fork / stale tree:** `/home/zac/projects/authichain-unified/services/agentz/` (not the setuptools package root).

### Post-audit remediation (same day, on `feature/minimal_violation_product`)

Applied after this report was written:

- Fixed `SyntaxError`; module compiles and imports.
- Hardened canonical `add_pending_dm`: lockfile, atomic replace, fingerprint + pending-lead idempotency, empty-payload reject, status dict return, 3-arg positional compat remap.
- Updated agentz callers: `hot_lead_outreach`, `authichain_partner_outreach`, `growth_loop_autonomous`, `outreach_reviewer`.
- Idempotency stress test **PASS**: `agentz/scripts/test_idempotency_add_pending_dm.py` (10 identical calls → 1 record).
- Remaining: `services/agentz` fork drift; live `pending_dms.json` still has historical `message: null` rows; A/B hooks still not used by `post_dm` send path.

---

## Executive summary

`add_pending_dm` is a JSON-file-backed enqueue helper for outreach DMs. The last **committed** canonical implementation (`HEAD` / `34688da6`) uses a **required 5-argument** signature for A/B hooks, while **every committed caller** still invokes the old **3-argument** form. That mismatch alone makes outreach enqueue paths fail with `TypeError` on `HEAD`.

The **working tree** (uncommitted at audit time) attempts hardening (file lock, atomic write, fingerprint idempotency, return dict, empty-payload checks) and updates agentz callers to the 5-arg form — but the working-tree `agentz/core/outreach.py` currently has a **`SyntaxError`** and cannot be imported or compiled.

`services/agentz` remains on the old 3-arg API and schema, with no A/B fields, no locking, and bare `except:`.

Live queue data at `agentz/logs/outreach/pending_dms.json` already contains A/B schema records with `"message": null`, confirming prior enqueue of incomplete payloads.

---

## Snapshot of what was audited

| Tree                     | Path                                  | `add_pending_dm` signature                                                            | Importable?                                                            |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **HEAD (committed)**     | `agentz/core/outreach.py:49`          | `(lead_name, personalized_hook, generic_hook, message, microsite_url)` — all required | Yes (committed)                                                        |
| **Working tree (dirty)** | `agentz/core/outreach.py:130-139`     | Defaults + invalid `*, **_kwargs`                                                     | **No** — `SyntaxError: named arguments must follow bare *` at line 136 |
| **services fork**        | `services/agentz/core/outreach.py:30` | `(lead_name, message, microsite_url)`                                                 | Yes                                                                    |

`python3 -m py_compile agentz/core/outreach.py` fails on the working tree. This audit therefore covers **both** the last good committed semantics and the incomplete WIP refactor.

---

## 1. Source & Sink Analysis

### 1.1 Inputs (canonical HEAD)

```49:70:agentz/core/outreach.py
def add_pending_dm(lead_name: str, personalized_hook: str, generic_hook: str, message: str, microsite_url: str):
    """Adds a new DM to the pending queue, randomly assigning either a personalized or generic hook for A/B testing."""
    dms = get_pending_dms()
    # Avoid duplicates
    if any(d['lead_name'] == lead_name for d in dms):
        return

    # Randomly assign A or B
    variant = random.choice(['personalized', 'generic'])
    chosen_hook = personalized_hook if variant == 'personalized' else generic_hook

    dms.append({
        "lead_name": lead_name,
        "variant": variant,
        "chosen_hook": chosen_hook,
        "personalized_hook": personalized_hook,
        "generic_hook": generic_hook,
        "message": message,
        "microsite_url": microsite_url,
        "status": "pending"
    })
    save_pending_dms(dms)
```

_(Line numbers above refer to **HEAD**. Working-tree line numbers differ; see § WIP notes.)_

| Parameter           | Type (annotation) | Business meaning                             |
| ------------------- | ----------------- | -------------------------------------------- |
| `lead_name`         | `str`             | Dedup key / display target                   |
| `personalized_hook` | `str`             | A/B variant A copy                           |
| `generic_hook`      | `str`             | A/B variant B copy                           |
| `message`           | `str`             | Full DM body (what reviewer currently sends) |
| `microsite_url`     | `str`             | CTA / microsite link shown in review UI      |

**Business checks on HEAD:** none beyond “skip if `lead_name` already present in list” (any status). No validation of non-empty message, URL shape, types at runtime, or lead existence.

**Working-tree additions (intended, currently unimportable):** reject empty `lead_name`; reject empty `message`+hooks; heuristic remap of historical 3-arg positional layout; SHA-256 payload fingerprint; `created_at`; return status dict.

### 1.2 Persistence sink

| Item         | Value                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Path         | `OUTREACH_DB_PATH = Path("agentz/logs/outreach/pending_dms.json")` (`agentz/core/outreach.py:14` HEAD / `:20` WT) |
| Format       | JSON array of objects                                                                                             |
| Write helper | `save_pending_dms` — HEAD: direct `Path.write_text`; WT: tempfile + `os.replace`                                  |
| Read helper  | `get_pending_dms` — returns `[]` on missing/corrupt file                                                          |

**CWD coupling:** the path is **relative to process CWD**, not package root or an env override. Running from a non-repo CWD creates a different (or empty) queue.

### 1.3 Downstream consumers (sinks of the queue)

| Consumer            | Path                                             | What it uses                                                                                                   |
| ------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Outreach reviewer   | `agentz/workflows/handlers/outreach_reviewer.py` | `get_pending_dms` / `save_pending_dms`; sends `dm['message']` via `post_dm`; ignores `chosen_hook` / `variant` |
| Analytics           | `agentz/core/analytics.py:18-43`                 | Reads same JSON; counts `variant` ∈ `{personalized,generic}` and `status == "responded_positively"`            |
| Optimization engine | `agentz/core/optimization_engine.py:12-35`       | Calls `calculate_conversion_rates` / `should_pivot`                                                            |
| Browser poster      | `agentz/core/outreach.py` `post_dm`              | Sends raw `message` string; does not compose from hooks                                                        |

**A/B effectiveness gap:** hooks are stored and scored by analytics, but the review/send path posts `message`, not `chosen_hook`. Unless callers embed the chosen hook into `message` themselves, the A/B experiment never reaches the prospect.

### 1.4 Observed live queue sample

`/home/zac/projects/authichain-unified/agentz/logs/outreach/pending_dms.json` contains records with A/B fields and `"message": null` (e.g. Cloud Cannabis, Oakley Signs). That matches dry-run hot-lead names and shows incomplete payloads were accepted by HEAD’s lack of message validation.

---

## 2. Idempotency

### HEAD behavior

```python
if any(d['lead_name'] == lead_name for d in dms):
    return
```

| Scenario                                                      | Behavior                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| Second call, same `lead_name`, any status still in file       | Silent no-op (`None`)                                        |
| Same lead after status → `sent`/`rejected` but record remains | Still blocked forever for that name                          |
| Same lead, different message/hooks                            | Blocked (name-only key)                                      |
| Different casing / whitespace (`"Nike"` vs `"nike "`)         | Treated as distinct → duplicates possible                    |
| Concurrent processes                                          | **Not idempotent** — classic read-modify-write race (see §3) |

No fingerprint, no logging on skip, no return value distinguishing `created` vs `ignored`.

### Working-tree intended behavior (broken by SyntaxError)

- Skip if same `lead_name` **and** `status == "pending"`.
- Skip if `fingerprint` matches (normalized lead + message + url + hooks).
- Returns `{"ok", "action", "lead_name", ...}` with `ignored_duplicate` / `created` / `rejected` / `error`.

**Residual WT races / gaps (even if syntax fixed):**

- `save_pending_dms` remains a public unlocked API; `outreach_reviewer` calls it outside `_acquire_lock`, so review + enqueue can still interleave.
- O_EXCL lockfile is process-local and stale-lock recovery is mtime-based (60s); not a substitute for `fcntl`/`portalocker` on all filesystems.
- Fingerprint ignores `status` history semantics: re-queue after reject with identical payload is blocked by fingerprint even when pending check would allow a new attempt — may be desired or not; undocumented.

---

## 3. Transaction / Atomicity

### HEAD

1. `get_pending_dms()` — full file read (bare `except:` → `[]` on any error, including partial JSON).
2. Mutate in-memory list.
3. `save_pending_dms()` — `write_text` of entire array (**non-atomic** truncate/rewrite).

**Partial failure modes:**

| Failure                      | Effect                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| Crash mid-`write_text`       | Truncated / corrupt JSON; next read returns `[]` (data loss masked as empty queue)                        |
| Two writers overlapping      | Lost updates (last writer wins); possible duplicate `lead_name` if both passed the dedup check            |
| Disk full / permission error | Exception propagates from `save_pending_dms`; in-memory work discarded (OK) but callers may not handle it |

No fsync, no temp+rename, no lock, no backup.

### Working-tree improvements (intended)

- `_acquire_lock` / `_release_lock` around read-check-append-save in `add_pending_dm`.
- `save_pending_dms`: `tempfile.mkstemp` → write → `fsync` → `os.replace`.

**Still incomplete:**

- Reviewer and analytics do not take the same lock.
- Corrupt-file recovery still returns `[]` (safer logging than HEAD, but still silent data-loss semantics).
- No schema migration / version field on records.

---

## 4. Error & Exception Handling

### HEAD `get_pending_dms`

```33:40:agentz/core/outreach.py
def get_pending_dms() -> List[Dict[str, Any]]:
    ...
    except:
        return []
```

- Bare `except:` swallows `KeyboardInterrupt`/`SystemExit` theoretically (in practice less common here) and **all** decode/OS errors with **no log**.
- Corrupt store looks identical to empty store.

### HEAD `add_pending_dm`

- No try/except of its own.
- Duplicate skip: silent `return`.
- `KeyError` if an existing record lacks `lead_name` (`d['lead_name']`).
- No retries (none appropriate for local FS beyond lock spin).
- Callers that catch broadly (e.g. hot-lead `except Exception`) will count a failed enqueue as “lead activation failed” or, worse, succeed past a silent skip.

### HEAD `post_dm` / LLM helpers

- `post_dm` logs and returns `False` on failure.
- `analyze_reply_sentiment` / mid-module `from agentz.core.llm import get_llm` — import-time coupling for unrelated functions when the module loads.

### Working-tree

- Narrower `(json.JSONDecodeError, OSError)` with `logger.error`.
- `add_pending_dm` wraps body in try/except → `logger.exception` + `{"ok": False, "action": "error", ...}` (callers still ignore return value today).
- Lock timeout → `TimeoutError` caught into error dict.
- **But:** module does not load, so none of this is live.

### Retries

None for FS operations beyond WT lock spin (`sleep 0.05` until timeout). No retry of save after transient `OSError`.

---

## 5. Caller signature mismatches

### Committed (`HEAD`) — all agentz callers wrong

Canonical required arity: **5 positional parameters**.

| Caller (HEAD)                                                 | Call                                                                           | Arity | Result vs HEAD def               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----- | -------------------------------- |
| `agentz/workflows/handlers/hot_lead_outreach.py:103`          | `add_pending_dm(name, message, site_url)`                                      | 3     | **`TypeError`**                  |
| `agentz/workflows/handlers/authichain_partner_outreach.py:59` | `add_pending_dm(brand_name, final_message, "https://authichain.com/partners")` | 3     | **`TypeError`**                  |
| `agentz/workflows/handlers/growth_loop_autonomous.py:75`      | `add_pending_dm(company, invitation, "https://authichain.com/demo")`           | 3     | **`TypeError`**                  |
| `agentz/workflows/handlers/outreach_reviewer.py:17-18`        | seed with 3 positional args ×2                                                 | 3     | **`TypeError`** when queue empty |

`git grep add_pending_dm HEAD` confirms no committed agentz caller passes hooks.

### Working tree — agentz callers updated; core broken

Uncommitted diffs update the four agentz handlers to keyword 5-arg form, e.g.:

- `hot_lead_outreach.py` — `lead_name=`, `personalized_hook=`, `generic_hook=`, `message=`, `microsite_url=`
- `authichain_partner_outreach.py`, `growth_loop_autonomous.py`, `outreach_reviewer.py` — same pattern

Those calls would be signature-compatible **if** the WT function definition compiled. It does not (`*, **_kwargs` alone is invalid Python).

### `services/agentz` callers (still 3-arg; import `agentz.core.outreach`)

| Caller                                                                 | Call                                                 | Notes                                                                       |
| ---------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `services/agentz/workflows/handlers/hot_lead_outreach.py:104`          | `add_pending_dm(name, message, site_url)`            | Imports **canonical** `agentz.core.outreach`, not the local services module |
| `services/agentz/workflows/handlers/authichain_partner_outreach.py:59` | `add_pending_dm(brand, final_message, "…/partners")` | Same — **3-arg against installed 5-arg package**                            |

Important: services handlers do **`from agentz.core.outreach import add_pending_dm`**, so at runtime they resolve to the **canonical package**, not `services/agentz/core/outreach.py`. The services copy is dead code for these imports unless `PYTHONPATH` is twisted to prefer `services/`.

### Return-value mismatches

- HEAD: implicit `None`.
- WT: status `dict`.
- No caller inspects the return value in either tree.

---

## 6. Divergence: `agentz/core/outreach.py` vs `services/agentz/core/outreach.py`

| Aspect                | Canonical `agentz/` (HEAD)                                  | `services/agentz/`                                     |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| Lines                 | 118                                                         | 66                                                     |
| Signature             | 5-arg A/B                                                   | 3-arg legacy                                           |
| Record fields         | + `variant`, `chosen_hook`, hooks                           | `lead_name`, `message`, `microsite_url`, `status` only |
| Prompt tuning helpers | Present (`PROMPT_TEMPLATE_PATH`, `tune_outreach_prompt`, …) | Absent                                                 |
| Sentiment / nurture   | Present (stubs/LLM)                                         | Absent                                                 |
| Dedup                 | By `lead_name`                                              | By `lead_name`                                         |
| Atomic write / lock   | No                                                          | No                                                     |
| Error logging on read | Bare `except:` → `[]`                                       | Bare `except:` → `[]`                                  |
| Reviewer policy       | Auto-approves in `Mode.AUTO`                                | Human-only gate (`Mode.CONFIRM`); no seed calls        |

`diff -u services/agentz/core/outreach.py agentz/core/outreach.py` (HEAD vs services) shows services is a strict older subset. Keeping both trees risks “fixed in one, broken in the other” drift — already visible in reviewer safety policy and API shape.

---

## 7. Concrete recommended fixes (ranked)

### P0 — Must fix before any outreach workflow run

1. **Repair or revert the working-tree SyntaxError** in `agentz/core/outreach.py` (`*, **_kwargs` without a keyword-only name). Until fixed, `import agentz.core.outreach` fails and **all** outreach flows are dead.
2. **Align signatures end-to-end on the installed package:**
   - Prefer keeping the 5-arg A/B API **and** ship the already-drafted agentz caller updates, **or**
   - Temporarily restore a compatible 3-arg API / adapter and deprecate.
3. **Stop depending on `services/agentz` copies** for runtime, or delete/redirect them so they cannot drift; services handlers already import canonical `agentz.core.outreach`.
4. **Reject empty/`null` messages** at enqueue time (live JSON already has `message: null`).

### P1 — Correctness & durability

5. **Atomic save + shared lock** for _all_ writers (`add_pending_dm` **and** `outreach_reviewer`’s `save_pending_dms`), e.g. one internal `_with_outreach_lock` helper; prefer `fcntl.flock` or `portalocker` over only O_EXCL lockfiles if multi-host/NFS matters.
6. **Make A/B real:** reviewer/`post_dm` should send `chosen_hook` (or a composed template that includes it), not only `message`; or stop collecting unused hooks.
7. **Idempotency policy documented in code:** name+pending vs fingerprint; decide whether re-queue after `rejected`/`sent` is allowed.
8. **Replace bare `except:`** in any remaining read path; log and optionally quarantine corrupt files (`pending_dms.json.corrupt-<ts>`).
9. **Absolute or env-configured DB path** (`AGENTZ_OUTREACH_DB` or path relative to package/`logs`).
10. **Callers must handle return status** (or raise on failure) so “queued” logs are truthful.

### P2 — Hygiene & productization

11. Add `schema_version`, `id` (UUID), and `updated_at` on records.
12. Normalize `lead_name` for dedup (`casefold().strip()`).
13. Move `import random` / `get_llm` to module top; avoid side-effectful mid-file imports.
14. Sync or remove `services/agentz` outreach module; make reviewer behavior consistent (CONFIRM-only vs AUTO seed).
15. Persist conversion outcomes (`responded_positively`) from a real reply pipeline so analytics/`should_pivot` are not vacuous.
16. Add structured metrics/logging (created vs duplicate vs error counts).

---

## 8. Suggested test cases

**There are currently zero tests** referencing `add_pending_dm` / `pending_dms` under `agentz/tests` or repo `tests/`.

### Unit tests

| ID  | Case                                | Expectation                                                                                                          |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| U1  | Create with valid 5-arg payload     | Record appended; `status=="pending"`; hooks + `variant` + `chosen_hook` set; `chosen_hook` ∈ {personalized, generic} |
| U2  | Missing/empty `lead_name`           | Reject; file unchanged                                                                                               |
| U3  | Empty `message` and empty hooks     | Reject (after P0 validation)                                                                                         |
| U4  | Duplicate `lead_name` while pending | Idempotent skip; single record                                                                                       |
| U5  | Corrupt JSON on disk                | Logged error; safe empty or quarantined; no crash                                                                    |
| U6  | `save_pending_dms` atomicity        | Kill/patch mid-write simulation → final file always valid JSON or prior version                                      |
| U7  | CWD independence                    | With chdir to temp, configured path still hits intended file                                                         |
| U8  | Reviewer send uses intended copy    | Posted text equals `chosen_hook` or documented composition of hook+message                                           |
| U9  | 3-arg legacy adapter (if kept)      | `(name, message, url)` remaps correctly; URL not stored as `generic_hook`                                            |
| U10 | Return contract                     | `action in {"created","ignored_duplicate","rejected","error"}`                                                       |

### Idempotency / concurrency stress

| ID  | Case                                                       | Expectation                                           |
| --- | ---------------------------------------------------------- | ----------------------------------------------------- |
| S1  | 100 serial identical calls                                 | Exactly one record                                    |
| S2  | Parallel processes × N same lead                           | Exactly one record; no corrupt JSON (lock held)       |
| S3  | Parallel different leads                                   | All unique leads present; no lost updates             |
| S4  | Interleaved `add_pending_dm` + reviewer `save_pending_dms` | No lost status transitions; no duplicate pending rows |
| S5  | Fingerprint: same payload after status `sent`              | Matches documented policy (block or allow)            |
| S6  | Rapid lock contention                                      | Timeouts surface as error status, not silent success  |

### Caller contract tests

| ID  | Case                                                    | Expectation                                                          |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| C1  | Static/import-lint or pytest parametrize all call sites | Arity/keywords match public signature                                |
| C2  | `hot_lead_outreach` dry-run without twitter session     | Enqueues non-null `message`                                          |
| C3  | `outreach_reviewer` empty-queue seed                    | Does not raise; seeds valid 5-arg records (or skips seeding in prod) |

---

## 9. Appendix — file / line index

| Artifact                    | Path                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Canonical impl (WT, broken) | `/home/zac/projects/authichain-unified/agentz/core/outreach.py`                                                             |
| Canonical impl (HEAD)       | same path @ git `HEAD` (`34688da6` lineage)                                                                                 |
| Services fork               | `/home/zac/projects/authichain-unified/services/agentz/core/outreach.py`                                                    |
| Queue file                  | `/home/zac/projects/authichain-unified/agentz/logs/outreach/pending_dms.json`                                               |
| Callers (agentz)            | `.../agentz/workflows/handlers/{hot_lead_outreach,authichain_partner_outreach,growth_loop_autonomous,outreach_reviewer}.py` |
| Callers (services)          | `.../services/agentz/workflows/handlers/{hot_lead_outreach,authichain_partner_outreach}.py`                                 |
| Analytics consumer          | `/home/zac/projects/authichain-unified/agentz/core/analytics.py`                                                            |
| Package root config         | `/home/zac/projects/authichain-unified/pyproject.toml`                                                                      |

---

## 10. Audit conclusion

`add_pending_dm` is a small function with outsized operational risk: **shared mutable JSON**, **no durable write protocol on HEAD**, **silent dedup**, and a **repo-wide signature split** between the 5-arg A/B API and lingering 3-arg callers (plus a stale `services/` copy). The working-tree remediation direction (lock, atomic replace, fingerprint, validation, caller updates) is sound but **currently unshippable** due to a syntax error and incomplete lock coverage for non-enqueue writers.

**Immediate priority:** restore an importable module, unify the public signature with every runtime caller (including services handlers that import `agentz.core.outreach`), and refuse null/empty messages so the pending queue cannot accumulate unsendable rows.
