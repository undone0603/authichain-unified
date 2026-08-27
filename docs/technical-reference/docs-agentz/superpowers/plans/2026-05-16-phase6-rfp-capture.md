# Phase 6 RFP Capture: Real Opportunities + Loop + Ledger

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `authichain_rfp_capture` (Phase 6 of `power_launch`) to real SAM.gov opportunities from `gov_pursue_list.csv`, draft every qualifying opportunity instead of only the top one, and track each through a real `drafted | reviewed | submitted | won | lost` ledger.

**Architecture:**
- A new module `agentz.core.grants_pipeline` owns CSV loading and the pipeline ledger (JSON file at `agentz/logs/grants/pipeline_ledger.json`). It is the single source of truth for "what opportunities exist and where each one stands."
- `agentz.core.grants.scout_grant_opportunities` becomes a thin wrapper that delegates to the pipeline loader and stops returning hardcoded mocks. The browser-use scout call (which today runs and then has its output thrown away) is removed; the existing CSV is the input.
- `authichain_rfp_capture.run` loops over every qualified opportunity, drafts each, and records `drafted` in the ledger. Re-runs are idempotent — opportunities already in `drafted` (or later) status are skipped.
- `govchain_proposal.run` is updated to call the same loader/ledger so the two handlers stop diverging.

**Tech Stack:** Python 3.9+, stdlib `csv` + `json` + `pathlib` + `datetime`, pytest, existing `agentz.core.llm` and `agentz.core.modes` primitives.

---

## File Structure

- **Create** `agentz/core/grants_pipeline.py` — pure CSV+ledger module. Functions: `load_pursue_list`, `qualified_opportunities`, `read_ledger`, `write_ledger`, `update_status`, `status_of`.
- **Create** `tests/test_grants_pipeline.py` — unit tests for the pipeline module (pure functions, no network).
- **Create** `tests/test_phase6_rfp_capture.py` — integration test for `authichain_rfp_capture` in DRY_RUN mode, asserting the loop runs over all qualified entries.
- **Modify** `agentz/core/grants.py` — strip mocks; `scout_grant_opportunities` delegates to `qualified_opportunities`. `draft_federal_proposal` and `save_proposal` unchanged.
- **Modify** `agentz/workflows/handlers/authichain_rfp_capture.py` — loop opportunities, write ledger entries, skip already-drafted.
- **Modify** `agentz/workflows/handlers/govchain_proposal.py` — replace its inline CSV reader and file-existence dedupe with calls to the pipeline module.

---

## Task 1: Pipeline module — CSV loader

**Files:**
- Create: `agentz/core/grants_pipeline.py`
- Test:  `tests/test_grants_pipeline.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_grants_pipeline.py
from pathlib import Path
import textwrap
from agentz.core.grants_pipeline import load_pursue_list


def test_load_pursue_list_parses_csv(tmp_path: Path):
    csv = tmp_path / "gov_pursue_list.csv"
    csv.write_text(
        textwrap.dedent(
            """\
            notice_id,title,agency,deadline,fit_score
            abc123,Sample Title,DOD,2030-01-01T00:00:00-04:00,85
            def456,Another,NIH,2030-02-01T00:00:00-04:00,60
            """
        ),
        encoding="utf-8",
    )

    rows = load_pursue_list(csv)

    assert len(rows) == 2
    assert rows[0]["notice_id"] == "abc123"
    assert rows[0]["fit_score"] == 85  # coerced to int
    assert rows[1]["fit_score"] == 60
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_grants_pipeline.py::test_load_pursue_list_parses_csv -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'agentz.core.grants_pipeline'`

- [ ] **Step 3: Write minimal implementation**

```python
# agentz/core/grants_pipeline.py
"""
agentz.core.grants_pipeline
---------------------------
CSV loader and pipeline ledger for federal grant opportunities (Phase 6).
"""
from __future__ import annotations
import csv
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CSV = REPO_ROOT / "gov_pursue_list.csv"


def load_pursue_list(csv_path: Path | str = DEFAULT_CSV) -> list[dict[str, Any]]:
    """Return all rows from the pursue list with fit_score coerced to int."""
    path = Path(csv_path)
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows: list[dict[str, Any]] = []
        for row in reader:
            try:
                row["fit_score"] = int(row.get("fit_score") or 0)
            except (TypeError, ValueError):
                row["fit_score"] = 0
            rows.append(row)
    return rows
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_grants_pipeline.py::test_load_pursue_list_parses_csv -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agentz/core/grants_pipeline.py tests/test_grants_pipeline.py
git commit -m "feat(phase6): add grants_pipeline.load_pursue_list with int fit_score coercion"
```

---

## Task 2: Pipeline module — qualified-opportunity filter

**Files:**
- Modify: `agentz/core/grants_pipeline.py`
- Test:  `tests/test_grants_pipeline.py`

- [ ] **Step 1: Write the failing tests**

```python
# Append to tests/test_grants_pipeline.py
import textwrap
from datetime import datetime, timezone
from pathlib import Path
from agentz.core.grants_pipeline import qualified_opportunities


def _write_csv(tmp_path: Path, body: str) -> Path:
    csv = tmp_path / "gov_pursue_list.csv"
    csv.write_text(textwrap.dedent(body), encoding="utf-8")
    return csv


def test_qualified_opportunities_filters_by_fit_and_deadline(tmp_path: Path):
    csv = _write_csv(
        tmp_path,
        """\
        notice_id,title,agency,deadline,fit_score
        high_future,Good,DOD,2099-01-01T00:00:00-04:00,85
        low_future,Low,DOD,2099-01-01T00:00:00-04:00,40
        high_past,Stale,DOD,2000-01-01T00:00:00-04:00,90
        """,
    )

    now = datetime(2026, 5, 16, tzinfo=timezone.utc)
    out = qualified_opportunities(csv, now=now, min_fit=80)

    notice_ids = [o["notice_id"] for o in out]
    assert notice_ids == ["high_future"]


def test_qualified_opportunities_sorts_descending_by_fit(tmp_path: Path):
    csv = _write_csv(
        tmp_path,
        """\
        notice_id,title,agency,deadline,fit_score
        a,A,DOD,2099-01-01T00:00:00-04:00,85
        b,B,DOD,2099-01-01T00:00:00-04:00,95
        c,C,DOD,2099-01-01T00:00:00-04:00,85
        """,
    )

    now = datetime(2026, 5, 16, tzinfo=timezone.utc)
    out = qualified_opportunities(csv, now=now, min_fit=80)

    assert [o["notice_id"] for o in out] == ["b", "a", "c"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_grants_pipeline.py -v`
Expected: Both new tests FAIL with `ImportError: cannot import name 'qualified_opportunities'`

- [ ] **Step 3: Write the implementation**

Append to `agentz/core/grants_pipeline.py`:

```python
from datetime import datetime, timezone


def _parse_deadline(raw: str) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def qualified_opportunities(
    csv_path: Path | str = DEFAULT_CSV,
    *,
    now: datetime | None = None,
    min_fit: int = 80,
) -> list[dict[str, Any]]:
    """Return rows with fit_score >= min_fit and deadline strictly in the future, sorted by fit_score desc (stable)."""
    cutoff = now or datetime.now(timezone.utc)
    if cutoff.tzinfo is None:
        cutoff = cutoff.replace(tzinfo=timezone.utc)

    rows = load_pursue_list(csv_path)
    out: list[dict[str, Any]] = []
    for row in rows:
        if row["fit_score"] < min_fit:
            continue
        deadline = _parse_deadline(row.get("deadline", ""))
        if deadline is None:
            continue
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        if deadline <= cutoff:
            continue
        out.append(row)

    out.sort(key=lambda r: r["fit_score"], reverse=True)
    return out
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_grants_pipeline.py -v`
Expected: All three tests PASS

- [ ] **Step 5: Commit**

```bash
git add agentz/core/grants_pipeline.py tests/test_grants_pipeline.py
git commit -m "feat(phase6): qualified_opportunities filter by fit_score + future deadline"
```

---

## Task 3: Pipeline module — ledger read/write/update

**Files:**
- Modify: `agentz/core/grants_pipeline.py`
- Test:  `tests/test_grants_pipeline.py`

- [ ] **Step 1: Write the failing tests**

```python
# Append to tests/test_grants_pipeline.py
from agentz.core.grants_pipeline import (
    read_ledger,
    update_status,
    status_of,
    LEDGER_STATUSES,
)


def test_ledger_is_empty_when_missing(tmp_path: Path):
    ledger_path = tmp_path / "pipeline_ledger.json"
    assert read_ledger(ledger_path) == {}
    assert status_of("never_seen", ledger_path) is None


def test_update_status_persists_and_round_trips(tmp_path: Path):
    ledger_path = tmp_path / "pipeline_ledger.json"

    update_status(
        "abc123",
        "drafted",
        ledger_path=ledger_path,
        title="Sample",
        agency="DOD",
    )

    assert status_of("abc123", ledger_path) == "drafted"
    data = read_ledger(ledger_path)
    assert data["abc123"]["status"] == "drafted"
    assert data["abc123"]["title"] == "Sample"
    assert "history" in data["abc123"]
    assert data["abc123"]["history"][-1]["status"] == "drafted"


def test_update_status_rejects_unknown_status(tmp_path: Path):
    import pytest
    with pytest.raises(ValueError):
        update_status("abc", "bogus", ledger_path=tmp_path / "x.json")


def test_ledger_statuses_constant():
    assert LEDGER_STATUSES == ("drafted", "reviewed", "submitted", "won", "lost")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_grants_pipeline.py -v`
Expected: New ledger tests FAIL with `ImportError`

- [ ] **Step 3: Write the implementation**

Append to `agentz/core/grants_pipeline.py`:

```python
import json

LOGS_DIR = Path(__file__).resolve().parents[1] / "logs" / "grants"
DEFAULT_LEDGER = LOGS_DIR / "pipeline_ledger.json"

LEDGER_STATUSES: tuple[str, ...] = ("drafted", "reviewed", "submitted", "won", "lost")


def read_ledger(ledger_path: Path | str = DEFAULT_LEDGER) -> dict[str, dict[str, Any]]:
    path = Path(ledger_path)
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def write_ledger(data: dict[str, dict[str, Any]], ledger_path: Path | str = DEFAULT_LEDGER) -> None:
    path = Path(ledger_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")


def status_of(notice_id: str, ledger_path: Path | str = DEFAULT_LEDGER) -> str | None:
    return read_ledger(ledger_path).get(notice_id, {}).get("status")


def update_status(
    notice_id: str,
    status: str,
    *,
    ledger_path: Path | str = DEFAULT_LEDGER,
    **metadata: Any,
) -> dict[str, Any]:
    if status not in LEDGER_STATUSES:
        raise ValueError(f"status must be one of {LEDGER_STATUSES}, got {status!r}")

    data = read_ledger(ledger_path)
    entry = data.get(notice_id, {})
    entry.update(metadata)
    entry["status"] = status
    history = entry.get("history", [])
    history.append({"status": status, "at": datetime.now(timezone.utc).isoformat()})
    entry["history"] = history
    data[notice_id] = entry
    write_ledger(data, ledger_path)
    return entry
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_grants_pipeline.py -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add agentz/core/grants_pipeline.py tests/test_grants_pipeline.py
git commit -m "feat(phase6): JSON-backed pipeline ledger with status history"
```

---

## Task 4: Strip mocks from `agentz.core.grants.scout_grant_opportunities`

**Files:**
- Modify: `agentz/core/grants.py:16-45`
- Test:  `tests/test_grants_pipeline.py`

- [ ] **Step 1: Write the failing test**

```python
# Append to tests/test_grants_pipeline.py
import asyncio
import textwrap
from datetime import datetime, timezone
from pathlib import Path
import agentz.core.grants_pipeline as gp
import agentz.core.grants as grants


def test_scout_uses_pipeline_loader(tmp_path: Path, monkeypatch):
    csv = tmp_path / "gov_pursue_list.csv"
    csv.write_text(
        textwrap.dedent(
            """\
            notice_id,title,agency,deadline,fit_score
            real_one,Real Opportunity,DOD,2099-01-01T00:00:00-04:00,90
            mock_dead,Dead,DOD,2000-01-01T00:00:00-04:00,90
            """
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(gp, "DEFAULT_CSV", csv)

    out = asyncio.run(grants.scout_grant_opportunities(ctx=None))

    notice_ids = [o["notice_id"] for o in out]
    assert "real_one" in notice_ids
    # Old hardcoded mocks must be gone
    assert "dla-secure-logistics" not in notice_ids
    assert "nih-counterfeit-detection" not in notice_ids
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_grants_pipeline.py::test_scout_uses_pipeline_loader -v`
Expected: FAIL — returned list contains the hardcoded mock IDs

- [ ] **Step 3: Rewrite `scout_grant_opportunities`**

Replace lines 16–45 of `agentz/core/grants.py` with:

```python
async def scout_grant_opportunities(ctx: Optional[ExecutionContext] = None) -> List[Dict[str, Any]]:
    """Return qualified federal opportunities from the pursue list (fit_score >= 80, deadline in the future)."""
    from agentz.core.grants_pipeline import qualified_opportunities
    return qualified_opportunities()
```

Also update the imports at the top of `agentz/core/grants.py` — remove the now-unused `browser_use`, `Controller`, `attach_interceptor`, `run_with_healing`, `get_llm` references *only* in `scout_grant_opportunities`; keep `get_llm` for `draft_federal_proposal`.

Replace the existing `from typing import Dict, Any, List, Optional` line if needed so `Any` is still imported (it already is).

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_grants_pipeline.py::test_scout_uses_pipeline_loader -v`
Expected: PASS

Also run the full new file to catch regressions:

Run: `pytest tests/test_grants_pipeline.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add agentz/core/grants.py tests/test_grants_pipeline.py
git commit -m "refactor(phase6): scout_grant_opportunities delegates to pipeline loader, drop mocks"
```

---

## Task 5: Loop drafts in `authichain_rfp_capture`, write ledger entries

**Files:**
- Modify: `agentz/workflows/handlers/authichain_rfp_capture.py`
- Create: `tests/test_phase6_rfp_capture.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_phase6_rfp_capture.py
import textwrap
from pathlib import Path
import agentz.core.grants_pipeline as gp
from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers import authichain_rfp_capture


def test_dry_run_loops_all_qualified(tmp_path: Path, monkeypatch, capsys):
    csv = tmp_path / "gov_pursue_list.csv"
    csv.write_text(
        textwrap.dedent(
            """\
            notice_id,title,agency,deadline,fit_score
            a,Alpha,DOD,2099-01-01T00:00:00-04:00,90
            b,Bravo,NIH,2099-01-01T00:00:00-04:00,85
            c,LowScore,DOD,2099-01-01T00:00:00-04:00,40
            """
        ),
        encoding="utf-8",
    )
    ledger = tmp_path / "pipeline_ledger.json"

    monkeypatch.setattr(gp, "DEFAULT_CSV", csv)
    monkeypatch.setattr(gp, "DEFAULT_LEDGER", ledger)

    ctx = ExecutionContext(mode=Mode.DRY_RUN, workflow_id="test_rfp_capture")
    result = authichain_rfp_capture.run(ctx)

    out = capsys.readouterr().out
    # Both qualified opportunities should be announced; the low-score one must not
    assert "Alpha" in out
    assert "Bravo" in out
    assert "LowScore" not in out
    # Dry-run must NOT write the ledger (no side-effects)
    assert not ledger.exists()
    # Returned summary should mention the count
    assert "2" in result


def test_skips_already_drafted(tmp_path: Path, monkeypatch):
    csv = tmp_path / "gov_pursue_list.csv"
    csv.write_text(
        textwrap.dedent(
            """\
            notice_id,title,agency,deadline,fit_score
            a,Alpha,DOD,2099-01-01T00:00:00-04:00,90
            b,Bravo,NIH,2099-01-01T00:00:00-04:00,85
            """
        ),
        encoding="utf-8",
    )
    ledger = tmp_path / "pipeline_ledger.json"
    monkeypatch.setattr(gp, "DEFAULT_CSV", csv)
    monkeypatch.setattr(gp, "DEFAULT_LEDGER", ledger)

    # Pre-seed: 'a' is already drafted
    gp.update_status("a", "drafted", ledger_path=ledger, title="Alpha", agency="DOD")

    # Avoid LLM and disk writes in AUTO mode
    monkeypatch.setattr(
        "agentz.core.grants.draft_federal_proposal",
        lambda grant: _fake_async("# draft for " + grant["notice_id"]),
    )
    monkeypatch.setattr(
        "agentz.core.grants.save_proposal",
        lambda name, content: str(tmp_path / f"{name}.md"),
    )

    ctx = ExecutionContext(mode=Mode.AUTO, workflow_id="test_rfp_capture", verbose=False)
    authichain_rfp_capture.run(ctx)

    data = gp.read_ledger(ledger)
    # 'a' was preserved; 'b' is newly drafted
    assert data["a"]["status"] == "drafted"
    assert data["b"]["status"] == "drafted"
    # 'b' should have exactly one history entry, 'a' should still have exactly one
    assert len(data["a"]["history"]) == 1
    assert len(data["b"]["history"]) == 1


async def _fake_async(value):
    return value
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_phase6_rfp_capture.py -v`
Expected: FAIL — current handler only drafts `opportunities[0]` and writes no ledger

- [ ] **Step 3: Rewrite the handler**

Replace the full contents of `agentz/workflows/handlers/authichain_rfp_capture.py` with:

```python
"""
agentz.workflows.handlers.authichain_rfp_capture
----------------------------------------------
Phase 6: Autonomous Federal RFP Capture.
Loads qualified opportunities from the pursue list, drafts a proposal
for each one not yet in the ledger, and records 'drafted' status.
"""
from __future__ import annotations
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.grants import draft_federal_proposal, save_proposal
from agentz.core.grants_pipeline import qualified_opportunities, status_of, update_status


def run(ctx: ExecutionContext) -> str:
    ctx.step("🎖️ --- INITIALIZING FEDERAL RFP CAPTURE MACHINE --- 🎖️")

    ctx.step("Loading qualified opportunities from pursue list...")
    opportunities = qualified_opportunities()
    if not opportunities:
        return "No qualified federal opportunities (fit_score >= 80, future deadline)."

    ctx.step(f"Found {len(opportunities)} qualified opportunities.")

    drafted = 0
    skipped = 0
    for opp in opportunities:
        notice_id = opp["notice_id"]
        existing = status_of(notice_id)
        if existing is not None:
            ctx.step(f"  ↪ Skipping {notice_id} ({opp['title']}): already '{existing}'")
            skipped += 1
            continue

        ctx.step(f"Drafting Phase 1 response for: {opp['title']} ({opp['agency']})")

        if ctx.mode == Mode.DRY_RUN:
            # No LLM call, no ledger write — describe only.
            continue

        content = ctx.step(
            f"LLM draft for {notice_id}",
            action=lambda o=opp: asyncio.run(draft_federal_proposal(o)),
        )
        if content is None:
            continue

        filename = f"federal_proposal_{notice_id}"
        path = save_proposal(filename, content)
        update_status(
            notice_id,
            "drafted",
            title=opp.get("title", ""),
            agency=opp.get("agency", ""),
            deadline=opp.get("deadline", ""),
            fit_score=opp.get("fit_score", 0),
            artifact_path=path,
        )
        ctx.step(f"  ✓ Saved {path}")
        drafted += 1

    return (
        f"Federal Capture complete: {drafted} drafted, {skipped} already in pipeline, "
        f"{len(opportunities)} qualified total."
    )
```

Notes for the implementer:
- `draft_federal_proposal` accepts `Dict[str, str]` today but our rows include an `int` `fit_score` — that's fine, the function only reads `title`, `agency`, `deadline`.
- The `lambda o=opp:` capture is deliberate (loop-binding).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_phase6_rfp_capture.py -v`
Expected: Both tests PASS

Also run the whole pipeline test file to confirm nothing regressed:

Run: `pytest tests/test_grants_pipeline.py tests/test_phase6_rfp_capture.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add agentz/workflows/handlers/authichain_rfp_capture.py tests/test_phase6_rfp_capture.py
git commit -m "feat(phase6): loop draft all qualified opportunities, record drafted in ledger"
```

---

## Task 6: Converge `govchain_proposal` onto the shared pipeline

**Files:**
- Modify: `agentz/workflows/handlers/govchain_proposal.py`
- Test:  `tests/test_phase6_rfp_capture.py`

- [ ] **Step 1: Write the failing test**

```python
# Append to tests/test_phase6_rfp_capture.py
import textwrap
from pathlib import Path
import agentz.core.grants_pipeline as gp
from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers import govchain_proposal


def test_govchain_proposal_uses_pipeline_and_writes_ledger(tmp_path: Path, monkeypatch):
    csv = tmp_path / "gov_pursue_list.csv"
    csv.write_text(
        textwrap.dedent(
            """\
            notice_id,title,agency,deadline,fit_score
            top,Top Opp,DOD,2099-01-01T00:00:00-04:00,95
            also,Other,NIH,2099-01-01T00:00:00-04:00,85
            """
        ),
        encoding="utf-8",
    )
    ledger = tmp_path / "pipeline_ledger.json"
    monkeypatch.setattr(gp, "DEFAULT_CSV", csv)
    monkeypatch.setattr(gp, "DEFAULT_LEDGER", ledger)

    # Stub out the LLM and the disk write inside govchain_proposal
    class _FakeLLM:
        def invoke(self, prompt):
            class R: content = "# stub proposal"
            return R()
    monkeypatch.setattr("agentz.workflows.handlers.govchain_proposal.get_llm", lambda **kw: _FakeLLM())

    proposals_dir = tmp_path / "content_grants"
    monkeypatch.setattr(
        "agentz.workflows.handlers.govchain_proposal.PROPOSALS_DIR",
        proposals_dir,
    )

    ctx = ExecutionContext(mode=Mode.AUTO, workflow_id="test_govchain", verbose=False)
    out = govchain_proposal.run(ctx)

    # Highest fit_score 'top' should have been picked
    assert "top" in out
    assert gp.status_of("top", ledger) == "drafted"
    # 'also' was not picked this run
    assert gp.status_of("also", ledger) is None
    # Drafted file exists in patched dir
    assert (proposals_dir / "top.md").exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_phase6_rfp_capture.py::test_govchain_proposal_uses_pipeline_and_writes_ledger -v`
Expected: FAIL — `PROPOSALS_DIR` doesn't exist as a module attribute, and the handler doesn't call the ledger

- [ ] **Step 3: Rewrite `govchain_proposal.py`**

Replace the full contents of `agentz/workflows/handlers/govchain_proposal.py` with:

```python
"""
agentz.workflows.handlers.govchain_proposal
-------------------------------------------
Picks the highest-fit unsubmitted grant from the shared pipeline and drafts a proposal.
"""
from __future__ import annotations
from pathlib import Path
from agentz.core.modes import ExecutionContext
from agentz.core.llm import get_llm
from agentz.core.grants_pipeline import qualified_opportunities, status_of, update_status

REPO_ROOT = Path(__file__).resolve().parents[3]
PROPOSALS_DIR = REPO_ROOT / "content" / "grants" / "govchain"


def run(ctx: ExecutionContext) -> str:
    ctx.step("Loading qualified grants from pursue list...")
    opportunities = qualified_opportunities()
    top = next((o for o in opportunities if status_of(o["notice_id"]) is None), None)
    if top is None:
        return "No unsubmitted qualified grants in pursue list."

    ctx.step(f"Drafting proposal for: {top['title']} (Score: {top['fit_score']})")

    prompt = f"""
    You are an expert grant writer for GovChain.us.
    Draft an SBIR/SVIP Phase 1 proposal for this opportunity:
    Title: {top['title']}
    Agency: {top['agency']}
    Notice ID: {top['notice_id']}

    GovChain is an autonomous engine for government compliance and auditing.
    Include Sections:
    1. Executive Summary
    2. Technical Approach
    3. Commercialization Strategy
    Output entirely in Markdown.
    """

    llm = get_llm(model="limit-proof", temperature=0.2)
    response = llm.invoke(prompt)

    PROPOSALS_DIR.mkdir(parents=True, exist_ok=True)
    draft_path = PROPOSALS_DIR / f"{top['notice_id']}.md"
    draft_path.write_text(response.content, encoding="utf-8")

    update_status(
        top["notice_id"],
        "drafted",
        title=top.get("title", ""),
        agency=top.get("agency", ""),
        deadline=top.get("deadline", ""),
        fit_score=top.get("fit_score", 0),
        artifact_path=str(draft_path),
    )

    ctx.step(f"Proposal saved to {draft_path}")
    return f"Drafted proposal for {top['notice_id']}"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_phase6_rfp_capture.py -v`
Expected: All PASS

Also confirm the full test file set still passes:

Run: `pytest tests/test_grants_pipeline.py tests/test_phase6_rfp_capture.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add agentz/workflows/handlers/govchain_proposal.py tests/test_phase6_rfp_capture.py
git commit -m "refactor(phase6): govchain_proposal shares grants_pipeline ledger + loader"
```

---

## Task 7: Sanity-check the broader test suite & smoke run

**Files:** (none modified)

- [ ] **Step 1: Run the full project test suite**

Run: `pytest -x -q`

Expected: All previously-passing tests still pass. Tests that require live infra (Supabase, HTTP endpoints) may xfail/skip; do not let those mask real regressions in `agentz.core.grants*` or `authichain_rfp_capture`.

- [ ] **Step 2: Dry-run smoke**

Run: `python -m agentz.cli run authichain_rfp_capture --mode dry-run`

Expected output contains:
- `INITIALIZING FEDERAL RFP CAPTURE MACHINE`
- A `Found N qualified opportunities.` line where N matches `qualified_opportunities()` against the real `gov_pursue_list.csv` (≥1 given the present file)
- No `Drafting Phase 1 response for: Supply Chain Zero-Trust` (the old mock)
- No exceptions

- [ ] **Step 3: Inspect the ledger location**

After Step 2 (dry-run only), `agentz/logs/grants/pipeline_ledger.json` should still NOT exist (dry-run is side-effect free).

If you want to verify the write path works, run an isolated unit test instead — do not perform an `auto` mode smoke run, since that calls the real LLM and writes real proposal files.

- [ ] **Step 4: Commit (only if any cleanup is needed)**

If Step 1 surfaced a real regression you had to fix, commit it now with a separate message. Otherwise, skip — there's nothing to commit.

```bash
git status
# Only commit if there are intentional fixes.
```

---

## Self-Review Checklist

- **Spec coverage:**
  - "Wire real opportunities in" → Tasks 1–4
  - "Loop & draft all qualified" → Task 5
  - "Pipeline ledger (drafted | reviewed | submitted | won | lost)" → Task 3 + ledger writes in Tasks 5–6
  - "Converge the two handlers" → Task 6
  - "Smoke-test it works end-to-end" → Task 7
- **Out of scope (deliberately deferred):**
  - Real SAM.gov submission step (was suggestion #5).
  - Refresh of `gov_pursue_list.csv` itself (handled by `pipeline_report.py`, untouched here).
  - Diagnosing why last night's run wrote the dry-run constant (suggestion #4) — likely orthogonal; once Phase 6 logs use the new ledger, this becomes self-evident on next run.
- **Type/name consistency:** `qualified_opportunities`, `status_of`, `update_status`, `read_ledger`, `write_ledger`, `LEDGER_STATUSES`, `DEFAULT_CSV`, `DEFAULT_LEDGER`, `PROPOSALS_DIR` are spelled identically in every task that references them.
- **Placeholders:** none — every step shows the code or the exact command.
