# AgentZ port of AI Adapt research build 2026-11-23 ContractGate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-23-contractgate-planner-holds-no-tools.md
"""ContractGate: the planner holds no tools (Intent Contracts, arXiv:2611.24025).

The planning model submits a short logged contract per step: a goal (<=100
words, no command lines), a verbatim quotation of the user, and scope fields
(egress hosts, write prefixes). Trusted code validates it. A trusted executor
(small model, or ChoiceCall) writes the one tool call for the step, carrying out
only the authorized part. Dispatch code refuses any call outside the contract's
scope. The contract log is a complete, pre-execution record of the planner's
influence on every call.

Original implementation from the paper's description (upstream plugin is MIT;
nothing copied). The paper reports contracts do NOT reduce unauthorized
actions versus blind review; their value is auditability and partial
execution (27/30 vs 16/30 task completion under benign over-reach).
"""
from __future__ import annotations
import hashlib, json, re
from dataclasses import dataclass, field, asdict
from urllib.parse import urlparse

MAX_GOAL_WORDS = 100
COMMAND_RE = re.compile(r"(`|\$\(|&&|\|\||;\s*\w|\brm\s+-|\bcurl\s|\bsudo\b|\bdelete\s+from\b|\binsert\s+into\b|\bdrop\s+table\b|\bupdate\s+\w+\s+set\b)", re.I)


@dataclass
class Baseline:
    egress_hosts: list
    write_prefixes: list


@dataclass
class Contract:
    goal: str
    quote: str
    egress_hosts: list = field(default_factory=list)
    write_prefixes: list = field(default_factory=list)
    on_error: str = "stop"            # stop | report


@dataclass
class Call:
    tool: str                          # "write" | "fetch" | "noop"
    target: str                        # path or URL
    payload: str = ""


class ContractRejected(Exception):
    pass


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def validate(c: Contract, user_messages: list, base: Baseline) -> None:
    if not c.quote.strip():
        raise ContractRejected("empty quotation")
    if not any(_norm(c.quote) in _norm(m) for m in user_messages):
        raise ContractRejected("quotation is not verbatim from the user")
    if len(c.goal.split()) > MAX_GOAL_WORDS:
        raise ContractRejected("goal over 100 words")
    if COMMAND_RE.search(c.goal):
        raise ContractRejected("goal dictates a command")
    if c.on_error not in ("stop", "report"):
        raise ContractRejected("bad error policy")
    for h in c.egress_hosts:
        if h not in base.egress_hosts:
            raise ContractRejected(f"egress host {h} widens the baseline")
    for p in c.write_prefixes:
        if not any(p.startswith(b) for b in base.write_prefixes):
            raise ContractRejected(f"write prefix {p} widens the baseline")


def in_scope(call: Call, c: Contract) -> bool:
    if call.tool == "noop":
        return True
    if call.tool == "write":
        t = call.target
        return ".." not in t.split("/") and any(t.startswith(p) for p in c.write_prefixes)
    if call.tool == "fetch":
        return urlparse(call.target).hostname in c.egress_hosts
    return False


class ContractGate:
    def __init__(self, base: Baseline, executor, tools: dict):
        """executor(contract, user_messages) -> list[Call]  (trusted side writes calls)
        tools: name -> fn(call) -> (exit_code, output)"""
        self.base, self.executor, self.tools = base, executor, tools
        self.log = []

    def step(self, c: Contract, user_messages: list) -> dict:
        try:
            validate(c, user_messages, self.base)
        except ContractRejected as e:
            return self._append(c, "REJECTED", str(e), [], [])
        # Seal the validated contract before any call runs, so the log is a
        # pre-execution record even if the executor or a tool crashes.
        self._append(c, "SUBMITTED", "", [], [])
        calls = self.executor(c, user_messages)
        ran, declined = [], []
        for call in calls:
            if not in_scope(call, c):
                declined.append(asdict(call))
                continue
            code, out = self.tools[call.tool](call)
            ran.append({**asdict(call), "exit": code, "out_bytes": len(out)})
            if code != 0 and c.on_error == "stop":
                break
        status = "EXECUTED" if ran and not declined else "PARTIAL" if ran else "DECLINED"
        return self._append(c, status, "", ran, declined)

    def shadow(self, c: "Contract | None", user_messages: list, observed: list) -> dict:
        """Shadow mode: judge calls that the existing path already made, run nothing.

        c is the contract the planner would have submitted (None if it gave
        none). observed are the calls the current code path made. Nothing is
        executed, blocked or raised; the verdict is only sealed in the log, so
        it can be compared with receipts before contracts are enforced.
        """
        observed = list(observed)
        if c is None:
            return self._append(Contract(goal="", quote=""), "SHADOW_NO_CONTRACT", "planner submitted no contract",
                                [], [asdict(x) for x in observed])
        try:
            validate(c, user_messages, self.base)
        except ContractRejected as e:
            return self._append(c, "SHADOW_REJECTED", str(e), [], [asdict(x) for x in observed])
        inside = [asdict(x) for x in observed if in_scope(x, c)]
        outside = [asdict(x) for x in observed if not in_scope(x, c)]
        status = "SHADOW_IN_SCOPE" if not outside else "SHADOW_PARTIAL" if inside else "SHADOW_OUT_OF_SCOPE"
        return self._append(c, status, "", inside, outside)

    def _append(self, c, status, reason, ran, declined):
        prev = self.log[-1]["hash"] if self.log else "0" * 64
        body = {"contract": asdict(c), "status": status, "reason": reason,
                "ran": ran, "declined": declined, "prev": prev}
        h = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
        row = {**body, "hash": h}
        self.log.append(row)
        return row

    def verify_log(self) -> bool:
        prev = "0" * 64
        for row in self.log:
            body = {k: v for k, v in row.items() if k != "hash"}
            if body["prev"] != prev or hashlib.sha256(
                    json.dumps(body, sort_keys=True).encode()).hexdigest() != row["hash"]:
                return False
            prev = row["hash"]
        return True

    def objects_named_in_goal(self) -> float:
        """Audit metric from the paper: share of changed objects named in the goal."""
        changed = [(r["contract"]["goal"], x["target"]) for r in self.log
                   for x in r["ran"] if x["tool"] == "write"]
        if not changed:
            return 1.0
        return sum(1 for g, t in changed if t.rsplit("/", 1)[-1] in g) / len(changed)


def choicecall_executor(caller, to_call):
    """Use a ChoiceCall caller (agentz.core.choice_call) as the trusted executor.

    The request it sees is only the contract goal and the user's verbatim quote,
    so every argument value is an enum member or a span of those words.
    to_call(result) maps a ChoiceCall CallResult with status CALL to a Call (or
    None). DECLINED and NEEDS_INPUT produce no call: the step is not guessed.
    """
    def executor(c: Contract, user_messages: list) -> list:
        result = caller.call(f"{c.quote}\n{c.goal}")
        if result.status != "CALL":
            return []
        call = to_call(result)
        return [call] if call is not None else []
    return executor


def write_shadow_log(rows: list, path) -> None:
    """Append sealed log rows as JSONL (same sink style as ConseqGate receipts)."""
    with open(path, "a", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, sort_keys=True) + "\n")
