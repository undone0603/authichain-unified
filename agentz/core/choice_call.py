# AgentZ port of AI Adapt research build 2026-11-22 ChoiceCall (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-22-choicecall-no-invented-args.md
"""ChoiceCall: tool calls without generated text (System 1 agents, arXiv:2611.21053).

A deterministic compiler turns each tool schema plus the request into
multiple-choice questions whose options come ONLY from the request text and
the schema. A one-pass decision model picks an option per question. Because
no value is ever generated, no argument can be invented: every argument is
either an enum member from the schema or a verbatim span of the request.

Original implementation from the paper's method description (upstream code is
Apache-2.0; nothing copied). Decision model is pluggable: in production, score
option letters with one LLM forward pass (logprobs); in tests, a mock.
"""
from __future__ import annotations
import hashlib, json, re
from dataclasses import dataclass, field

DECLINE = "NONE_OF_THESE"
NOT_STATED = "NOT_STATED"
NUM_RE = re.compile(r"(?<![\w.])-?\d+(?:\.\d+)?(?![\w.])")
QUOTED_RE = re.compile(r"[\"']([^\"']{1,120})[\"']")


@dataclass
class Param:
    name: str
    type: str                      # "number" | "enum" | "string" | "bool"
    required: bool = True
    enum: list = field(default_factory=list)
    pattern: str | None = None     # regex that string values must match
    description: str = ""


@dataclass
class Tool:
    name: str
    description: str
    params: list


@dataclass
class Question:
    key: str                       # "tool" or "<tool>.<param>"
    prompt: str
    options: list


@dataclass
class CallResult:
    status: str                    # CALL | DECLINED | NEEDS_INPUT
    tool: str | None
    args: dict
    missing: list
    questions: int
    record_hash: str


def candidate_values(request: str, p: Param) -> list:
    """Options for one parameter: drawn only from the request and the schema."""
    if p.type == "enum":
        opts = list(p.enum)
    elif p.type == "bool":
        opts = ["true", "false"]
    elif p.type == "number":
        opts = list(dict.fromkeys(NUM_RE.findall(request)))
    else:  # string
        spans = QUOTED_RE.findall(request)
        if p.pattern:
            spans += [m.group(0) for m in re.finditer(p.pattern, request)]
        opts = list(dict.fromkeys(s for s in spans
                                  if not p.pattern or re.fullmatch(p.pattern, s)))
    return opts + [NOT_STATED]


def compile_tool_question(request: str, tools: list) -> Question:
    return Question("tool", f"Request: {request}\nWhich tool serves this request?",
                    [t.name for t in tools] + [DECLINE])


def compile_param_questions(request: str, tool: Tool) -> list:
    return [Question(f"{tool.name}.{p.name}",
                     f"Request: {request}\nTool: {tool.name}\n"
                     f"Value for '{p.name}' ({p.description or p.type})?",
                     candidate_values(request, p))
            for p in tool.params]


def _coerce(p: Param, v: str):
    if p.type == "number":
        return float(v) if "." in v else int(v)
    if p.type == "bool":
        return v == "true"
    return v


def provenance_ok(request: str, tool: Tool, args: dict) -> bool:
    """Invariant: every value is a schema enum member or a verbatim request span."""
    by = {p.name: p for p in tool.params}
    for k, v in args.items():
        p = by[k]
        if p.type in ("enum",):
            if v not in p.enum:
                return False
        elif p.type == "bool":
            continue
        elif str(v) not in request and str(v).rstrip("0").rstrip(".") not in request:
            return False
    return True


class ChoiceCaller:
    def __init__(self, tools: list, decide):
        """decide(question) -> index into question.options (one pass, no text)."""
        self.tools = {t.name: t for t in tools}
        self.tool_list = tools
        self.decide = decide
        self.ledger = []

    def _pick(self, q: Question) -> str:
        i = self.decide(q)
        if not isinstance(i, int) or not 0 <= i < len(q.options):
            raise ValueError(f"decision model returned out-of-range index for {q.key}")
        return q.options[i]

    def call(self, request: str) -> CallResult:
        asked = 1
        choice = self._pick(compile_tool_question(request, self.tool_list))
        if choice == DECLINE:
            return self._seal(CallResult("DECLINED", None, {}, [], asked, ""), request)
        tool = self.tools[choice]
        args, missing = {}, []
        for p, q in zip(tool.params, compile_param_questions(request, tool)):
            asked += 1
            v = self._pick(q)
            if v == NOT_STATED:
                if p.required:
                    missing.append(p.name)
                continue
            args[p.name] = _coerce(p, v)
        if not provenance_ok(request, tool, args):   # defence in depth
            raise AssertionError("invented value reached a call")
        status = "NEEDS_INPUT" if missing else "CALL"
        return self._seal(CallResult(status, tool.name, args, missing, asked, ""), request)

    def _seal(self, r: CallResult, request: str) -> CallResult:
        prev = self.ledger[-1]["hash"] if self.ledger else "0" * 64
        body = {"request_sha": hashlib.sha256(request.encode()).hexdigest(),
                "status": r.status, "tool": r.tool, "args": r.args,
                "missing": r.missing, "prev": prev}
        h = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
        self.ledger.append({**body, "hash": h})
        r.record_hash = h
        return r

    def verify_ledger(self) -> bool:
        prev = "0" * 64
        for row in self.ledger:
            body = {k: v for k, v in row.items() if k != "hash"}
            if body["prev"] != prev:
                return False
            if hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest() != row["hash"]:
                return False
            prev = row["hash"]
        return True
