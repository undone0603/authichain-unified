"use client";

import { useEffect, useState } from "react";
import {
  ARTICLES,
  FIRE_REASONS,
  LICENSES,
  REWARD_KINDS,
  STAGE_LABEL,
  addDays,
  blankCase,
  canDiscard,
  fingerprint,
  fireBlockers,
  interviewBlockers,
  jobBlockers,
  requiredOffboard,
  rewardBlockers,
  screenBlockers,
  today,
  withEvent,
  type CaseFile,
  type FireReason,
  type RewardKind,
  type Tenure,
} from "../../lib/bench/law";

const CHECKOUT = "https://buy.stripe.com/7sY6oH0EVf7M25Yazy1ND3K";
const KEY = "bench-folio-v1";

const BOTS = [
  ["Inbox", "Sorts each note into Reply, Wait, or Drop, and drafts the Reply.", "Never sends."],
  ["Follow-up", "Writes one nudge after four quiet days.", "Never sends the nudge."],
  ["Shop", "States the price and what the kit does not do.", "Never invents a buyer."],
] as const;

type Leaf = "kit" | "law" | "desk";

const inputCls =
  "mt-1 w-full border-b border-[#1a1714]/25 bg-transparent px-0 py-2 text-[15px] outline-none focus:border-[#b8431f]";

export default function Folio() {
  const [leaf, setLeaf] = useState<Leaf>("kit");
  const [turning, setTurning] = useState(false);
  const [article, setArticle] = useState("01");
  const [cases, setCases] = useState<CaseFile[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setCases(raw ? (JSON.parse(raw) as CaseFile[]) : []);
    } catch {
      setCases([]);
    }
  }, []);

  useEffect(() => {
    if (cases) localStorage.setItem(KEY, JSON.stringify(cases));
  }, [cases]);

  function turn(next: Leaf, n?: string) {
    if (n) setArticle(n);
    if (next === leaf) {
      if (n) setLeaf("law");
      return;
    }
    setTurning(true);
    window.setTimeout(() => {
      setLeaf(next);
      setTurning(false);
    }, 280);
  }

  const open = cases?.find((c) => c.id === openId) ?? null;

  function save(next: CaseFile) {
    setCases((prev) => (prev ?? []).map((c) => (c.id === next.id ? next : c)));
  }

  return (
    <div className="min-h-screen bg-[#0c0c0d] px-3 py-8 text-[#f3efe6] md:px-8 md:py-14">
      <style>{`
        .folio-sheet { transform-origin: left center; transition: transform .45s ease; }
        .folio-sheet.is-turning { transform: rotateY(-16deg); }
        @media (prefers-reduced-motion: reduce) {
          .folio-sheet, .folio-sheet.is-turning { transition: none; transform: none; }
        }
      `}</style>
      <div className="mx-auto flex max-w-5xl">
        <aside className="flex w-11 shrink-0 flex-col items-center bg-[#b8431f] py-4 text-[#f3efe6] md:w-14">
          <span className="mb-4 text-[10px] font-semibold tracking-[0.35em] [writing-mode:vertical-rl]">BENCH</span>
          <div className="flex flex-1 flex-col justify-between py-2">
            {ARTICLES.map((a) => (
              <button
                key={a.n}
                type="button"
                onClick={() => turn("law", a.n)}
                className={`font-mono text-[10px] leading-none ${article === a.n && leaf === "law" ? "text-[#1a1714]" : "text-[#f3efe6]/80"}`}
                aria-label={`Article ${a.n}`}
              >
                {a.n}
              </button>
            ))}
          </div>
        </aside>
        <div className={`folio-sheet min-h-[78vh] flex-1 bg-[#f3efe6] text-[#1a1714] shadow-[12px_18px_40px_rgba(0,0,0,.45)] ${turning ? "is-turning" : ""}`}>
          <header className="flex items-baseline justify-between border-b border-[#1a1714]/15 px-5 py-4 md:px-8">
            <p className="font-serif text-lg">The folio</p>
            <nav className="flex gap-4 text-sm">
              {(["kit", "law", "desk"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => turn(id)}
                  className={leaf === id ? "border-b border-[#b8431f] text-[#1a1714]" : "text-[#1a1714]/45"}
                >
                  {id === "kit" ? "Kit" : id === "law" ? "Law" : "Desk"}
                </button>
              ))}
            </nav>
          </header>
          <div className="px-5 py-6 md:px-10 md:py-8">
            {leaf === "kit" && <Kit />}
            {leaf === "law" && <Law n={article} />}
            {leaf === "desk" && (
              <Desk
                cases={cases}
                open={open}
                onOpen={setOpenId}
                onClose={() => setOpenId(null)}
                onCreate={(file) => {
                  setCases((prev) => [file, ...(prev ?? [])]);
                  setOpenId(file.id);
                }}
                onSave={save}
                onDrop={(id) => {
                  setCases((prev) => (prev ?? []).filter((c) => c.id !== id));
                  setOpenId(null);
                }}
              />
            )}
          </div>
        </div>
      </div>
      <p className="mx-auto mt-4 max-w-5xl font-mono text-[11px] text-[#f3efe6]/45">
        A fingerprint in the gutter is a mark of the words on this device. It is not a seal on a chain.
      </p>
    </div>
  );
}

function Kit() {
  return (
    <div className="max-w-xl">
      <p className="text-xs font-semibold tracking-[0.2em] text-[#b8431f]">ONE PAYMENT · $97</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">Three bots that already know their job.</h1>
      <p className="mt-4 text-[17px] leading-relaxed">
        Pay once. The receipt is the product. Paste each charter into your own assistant. Nothing is hosted, and nothing bills you next month.
      </p>
      <a href={CHECKOUT} className="mt-6 inline-block bg-[#b8431f] px-5 py-3 text-sm font-semibold text-[#f3efe6]">
        Pay $97 and get the bots
      </a>
      <p className="mt-2 text-sm text-[#1a1714]/60">The card is charged now. The kit is on the confirmation page. This does not transfer a Grok bot.</p>
      <ul className="mt-8 divide-y divide-[#1a1714]/10 border-y border-[#1a1714]/10">
        {BOTS.map(([name, job, refuses]) => (
          <li key={name} className="py-4">
            <p className="font-serif text-2xl">{name}</p>
            <p className="mt-1">{job}</p>
            <p className="mt-1 text-sm text-[#1a1714]/60">{refuses}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Law({ n }: { n: string }) {
  const current = ARTICLES.find((a) => a.n === n) ?? ARTICLES[0];
  return (
    <article>
      <p className="font-mono text-sm text-[#b8431f]">{current.n}</p>
      <h1 className="mt-2 font-serif text-4xl">{current.title}</h1>
      <div className="mt-6 max-w-xl space-y-4 text-[17px] leading-relaxed">
        {current.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <p className="mt-8 font-mono text-xs text-[#1a1714]/45">mark {fingerprint(`${current.n}|${current.title}|${current.body.join(" ")}`)}</p>
    </article>
  );
}

function Desk({
  cases,
  open,
  onOpen,
  onClose,
  onCreate,
  onSave,
  onDrop,
}: {
  cases: CaseFile[] | null;
  open: CaseFile | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  onCreate: (file: CaseFile) => void;
  onSave: (file: CaseFile) => void;
  onDrop: (id: string) => void;
}) {
  const [making, setMaking] = useState(false);
  if (cases === null) return <p className="text-[#1a1714]/60">Opening the book.</p>;
  if (open) return <FileView file={open} onBack={onClose} onSave={onSave} onDrop={() => onDrop(open.id)} />;
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">The book</h1>
          <p className="mt-2 max-w-md text-[#1a1714]/70">A seat starts as a requisition. Praise is not a wage.</p>
        </div>
        <button type="button" onClick={() => setMaking((v) => !v)} className="bg-[#1a1714] px-4 py-2 text-sm text-[#f3efe6]">
          Open a seat
        </button>
      </div>
      {making && (
        <SeatForm
          onFile={(file) => {
            onCreate(file);
            setMaking(false);
          }}
        />
      )}
      {cases.length === 0 ? (
        <p className="mt-8 text-[#1a1714]/60">The book is empty.</p>
      ) : (
        <ul className="mt-6 divide-y divide-[#1a1714]/10">
          {cases.map((file) => (
            <li key={file.id}>
              <button type="button" onClick={() => onOpen(file.id)} className="flex w-full items-baseline justify-between gap-4 py-3 text-left">
                <span>
                  <span className="font-serif text-xl">{file.name}</span>
                  <span className="ml-3 text-sm text-[#1a1714]/55">{STAGE_LABEL[file.stage]}</span>
                </span>
                <span className="font-mono text-xs text-[#b8431f]">{file.events.at(-1)?.mark}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SeatForm({ onFile }: { onFile: (file: CaseFile) => void }) {
  const [name, setName] = useState("");
  const [tenure, setTenure] = useState<Tenure>("open");
  const [job, setJob] = useState("");
  const [antiJobs, setAntiJobs] = useState("");
  const [why, setWhy] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  return (
    <form
      className="mt-6 max-w-lg space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const file = blankCase({ name, tenure, job, antiJobs, why });
        const blocked = jobBlockers(file);
        if (blocked.length) {
          setErrors(blocked);
          return;
        }
        onFile(file);
      }}
    >
      <label className="block text-sm">Name<input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="block text-sm">
        Tenure
        <select className={inputCls} value={tenure} onChange={(e) => setTenure(e.target.value as Tenure)}>
          <option value="open">Open source</option>
          <option value="private">Private</option>
        </select>
      </label>
      <label className="block text-sm">One job<input className={inputCls} value={job} onChange={(e) => setJob(e.target.value)} /></label>
      <label className="block text-sm">Anti-jobs<input className={inputCls} value={antiJobs} onChange={(e) => setAntiJobs(e.target.value)} /></label>
      <label className="block text-sm">Why this seat<input className={inputCls} value={why} onChange={(e) => setWhy(e.target.value)} /></label>
      {errors.map((err) => (
        <p key={err} className="text-sm text-[#b8431f]">{err}</p>
      ))}
      <button type="submit" className="bg-[#b8431f] px-4 py-2 text-sm text-[#f3efe6]">File requisition</button>
    </form>
  );
}

function FileView({
  file,
  onBack,
  onSave,
  onDrop,
}: {
  file: CaseFile;
  onBack: () => void;
  onSave: (file: CaseFile) => void;
  onDrop: () => void;
}) {
  return (
    <div className="max-w-xl">
      <button type="button" onClick={onBack} className="text-sm text-[#1a1714]/55">Back to the book</button>
      <h1 className="mt-3 font-serif text-4xl">{file.name}</h1>
      <p className="mt-1 text-sm text-[#1a1714]/60">
        {file.tenure === "open" ? "Open source" : "Private"} · {STAGE_LABEL[file.stage]} · opened {file.openedOn}
      </p>
      <p className="mt-4 text-[17px]">{file.job}</p>
      <p className="mt-1 text-sm text-[#1a1714]/70">Refuses: {file.antiJobs}</p>
      <div className="mt-6">
        {file.stage === "requisition" && <Pass label="Accept requisition" errors={[]} onPass={() => onSave(withEvent(file, "Accepted", "Seat accepted.", { stage: "screen" }))} />}
        {file.stage === "screen" && <Screen file={file} onSave={onSave} />}
        {file.stage === "interview" && <Interview file={file} onSave={onSave} />}
        {file.stage === "offer" && (
          <Pass
            label="Accept the offer"
            errors={[]}
            onPass={() => onSave(withEvent(file, "Offer", `Probation until ${addDays(today(), 7)}.`, { stage: "probation" }))}
          />
        )}
        {file.stage === "probation" && <Probation file={file} onSave={onSave} />}
        {file.stage === "active" && <Active file={file} onSave={onSave} />}
        {file.stage === "pip" && (
          <Note
            label="Clear the PIP"
            onPass={(note) => onSave(withEvent(file, "PIP cleared", note, { stage: "active", pipRule: "", pipEvidence: "", pipEnds: "" }))}
          />
        )}
        {(file.stage === "active" || file.stage === "pip" || file.stage === "probation") && <Fire file={file} onSave={onSave} />}
        {canDiscard(file.stage) && (
          <button type="button" onClick={onDrop} className="mt-4 block text-sm text-[#1a1714]/50">Discard this file</button>
        )}
      </div>
      <ol className="mt-8 space-y-3 border-t border-[#1a1714]/10 pt-4">
        {file.events.map((event) => (
          <li key={`${event.mark}-${event.action}`} className="flex justify-between gap-4 text-sm">
            <span>
              <span className="block text-[#1a1714]/45">{event.at}</span>
              {event.action}. {event.detail}
            </span>
            <span className="font-mono text-xs text-[#b8431f]">{event.mark}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Pass({ label, errors, onPass }: { label: string; errors: string[]; onPass: () => void }) {
  return (
    <div>
      {errors.map((err) => <p key={err} className="text-sm text-[#b8431f]">{err}</p>)}
      <button type="button" onClick={onPass} disabled={errors.length > 0} className="bg-[#1a1714] px-4 py-2 text-sm text-[#f3efe6] disabled:opacity-40">{label}</button>
    </div>
  );
}

function Screen({ file, onSave }: { file: CaseFile; onSave: (file: CaseFile) => void }) {
  const [draft, setDraft] = useState(file);
  const errors = screenBlockers(draft);
  return (
    <div className="space-y-3">
      {file.tenure === "open" ? (
        <>
          <label className="block text-sm">Source<input className={inputCls} value={draft.sourceUrl} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} /></label>
          <label className="block text-sm">License
            <select className={inputCls} value={draft.license} onChange={(e) => setDraft({ ...draft, license: e.target.value })}>
              <option value="">Choose</option>
              {LICENSES.map((lic) => <option key={lic}>{lic}</option>)}
            </select>
          </label>
          <Check label="Attribution is on the record" checked={draft.attribution} onChange={(v) => setDraft({ ...draft, attribution: v })} />
          <Check label="No secrets in the public tree" checked={draft.noSecrets} onChange={(v) => setDraft({ ...draft, noSecrets: v })} />
          <Check label="A written exception is granted" checked={draft.exceptionGranted} onChange={(v) => setDraft({ ...draft, exceptionGranted: v })} />
          {draft.exceptionGranted && <input className={inputCls} value={draft.exceptionText} onChange={(e) => setDraft({ ...draft, exceptionText: e.target.value })} placeholder="The exception, in a sentence" />}
        </>
      ) : (
        <>
          <label className="block text-sm">Owner<input className={inputCls} value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} /></label>
          <Check label="Keys stay with the owner" checked={draft.keysWithOwner} onChange={(v) => setDraft({ ...draft, keysWithOwner: v })} />
          <Check label="The charter is not public" checked={draft.notPublished} onChange={(v) => setDraft({ ...draft, notPublished: v })} />
        </>
      )}
      {errors.map((err) => <p key={err} className="text-sm text-[#b8431f]">{err}</p>)}
      <button type="button" disabled={errors.length > 0} className="bg-[#1a1714] px-4 py-2 text-sm text-[#f3efe6] disabled:opacity-40" onClick={() => onSave(withEvent(draft, "Screened", "Screen passed.", { ...draft, stage: "interview" }))}>Pass the screen</button>
    </div>
  );
}

function Interview({ file, onSave }: { file: CaseFile; onSave: (file: CaseFile) => void }) {
  const [draft, setDraft] = useState(file);
  const errors = interviewBlockers(draft);
  return (
    <div className="space-y-3">
      <Check label="The job is one duty" checked={draft.oneDutyConfirmed} onChange={(v) => setDraft({ ...draft, oneDutyConfirmed: v })} />
      <Check label="Draft only" checked={draft.draftOnly} onChange={(v) => setDraft({ ...draft, draftOnly: v })} />
      <Check label="Sending is part of the job" checked={draft.sendsAllowed} onChange={(v) => setDraft({ ...draft, sendsAllowed: v })} />
      {draft.sendsAllowed && <input className={inputCls} value={draft.sendAcceptance} onChange={(e) => setDraft({ ...draft, sendAcceptance: e.target.value })} placeholder="Written acceptance" />}
      <Check label="A person checked one real example" checked={draft.tested} onChange={(v) => setDraft({ ...draft, tested: v })} />
      {errors.map((err) => <p key={err} className="text-sm text-[#b8431f]">{err}</p>)}
      <button type="button" disabled={errors.length > 0} className="bg-[#1a1714] px-4 py-2 text-sm text-[#f3efe6] disabled:opacity-40" onClick={() => onSave(withEvent(draft, "Interviewed", "Interview passed.", { ...draft, stage: "offer" }))}>Pass the interview</button>
    </div>
  );
}

function Probation({ file, onSave }: { file: CaseFile; onSave: (file: CaseFile) => void }) {
  const [proof, setProof] = useState(file.probationProof);
  const [clean, setClean] = useState(file.noAntiJobDuringProbation);
  const blocked = proof.trim().length < 12 || !clean;
  return (
    <div className="space-y-3">
      <label className="block text-sm">What was checked<input className={inputCls} value={proof} onChange={(e) => setProof(e.target.value)} /></label>
      <Check label="No anti-job during probation" checked={clean} onChange={setClean} />
      {blocked && <p className="text-sm text-[#b8431f]">Name the check, and confirm no anti-job.</p>}
      <button type="button" disabled={blocked} className="bg-[#1a1714] px-4 py-2 text-sm text-[#f3efe6] disabled:opacity-40" onClick={() => onSave(withEvent(file, "Probation passed", proof, { stage: "active", probationProof: proof, noAntiJobDuringProbation: true }))}>Pass probation</button>
      {!file.extensionUsed && (
        <button type="button" className="block text-sm" onClick={() => onSave(withEvent(file, "Extended", "Seven more days, once.", { extensionUsed: true }))}>Extend seven days, once</button>
      )}
    </div>
  );
}

function Active({ file, onSave }: { file: CaseFile; onSave: (file: CaseFile) => void }) {
  const [kind, setKind] = useState<RewardKind | "">("");
  const [what, setWhat] = useState("");
  const [evidence, setEvidence] = useState("");
  const errors = rewardBlockers(file, kind, what, evidence);
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#1a1714]/70">A reward posts only after a check this bot did not grade.</p>
      <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as RewardKind | "")}>
        <option value="">Reward</option>
        {REWARD_KINDS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <input className={inputCls} value={what} onChange={(e) => setWhat(e.target.value)} placeholder="What is given" />
      <input className={inputCls} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Who checked it" />
      {errors.map((err) => <p key={err} className="text-sm text-[#b8431f]">{err}</p>)}
      <button
        type="button"
        disabled={errors.length > 0}
        className="bg-[#b8431f] px-4 py-2 text-sm text-[#f3efe6] disabled:opacity-40"
        onClick={() => {
          if (!kind) return;
          const mark = fingerprint(`${today()}|${kind}|${what}|${evidence}`);
          onSave(withEvent(file, "Rewarded", `${kind}: ${what}`, { rewards: [...file.rewards, { at: today(), kind, what, evidence, mark }] }));
        }}
      >
        Post the reward
      </button>
      <Pip file={file} onSave={onSave} />
    </div>
  );
}

function Pip({ file, onSave }: { file: CaseFile; onSave: (file: CaseFile) => void }) {
  const [rule, setRule] = useState("");
  const [evidence, setEvidence] = useState("");
  return (
    <div className="mt-6 space-y-2 border-t border-[#1a1714]/10 pt-4">
      <p className="text-sm">Open a PIP</p>
      <input className={inputCls} value={rule} onChange={(e) => setRule(e.target.value)} placeholder="The rule that broke" />
      <input className={inputCls} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="What happened" />
      <button
        type="button"
        className="text-sm"
        onClick={() => {
          if (rule.trim().length < 8 || evidence.trim().length < 12) return;
          onSave(withEvent(file, "PIP", evidence, { stage: "pip", pipRule: rule, pipEvidence: evidence, pipEnds: addDays(today(), 7) }));
        }}
      >
        Open the PIP
      </button>
    </div>
  );
}

function Fire({ file, onSave }: { file: CaseFile; onSave: (file: CaseFile) => void }) {
  const [reason, setReason] = useState<FireReason | "">("");
  const [evidence, setEvidence] = useState("");
  const [checks, setChecks] = useState<string[]>([]);
  const errors = fireBlockers(file, reason, evidence, checks);
  return (
    <div className="mt-6 space-y-2 border-t border-[#1a1714]/10 pt-4">
      <p className="text-sm">Fire</p>
      <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value as FireReason | "")}>
        <option value="">Reason</option>
        {FIRE_REASONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <input className={inputCls} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Evidence" />
      {requiredOffboard(file.tenure).map((item) => (
        <Check
          key={item.id}
          label={item.label}
          checked={checks.includes(item.id)}
          onChange={(on) => setChecks((prev) => (on ? [...prev, item.id] : prev.filter((id) => id !== item.id)))}
        />
      ))}
      {errors.map((err) => <p key={err} className="text-sm text-[#b8431f]">{err}</p>)}
      <button type="button" disabled={errors.length > 0} className="bg-[#1a1714] px-4 py-2 text-sm text-[#f3efe6] disabled:opacity-40" onClick={() => reason && onSave(withEvent(file, "Fired", evidence, { stage: "terminated", fireReason: reason, fireEvidence: evidence, offboard: checks }))}>
        Terminate, and keep the record
      </button>
    </div>
  );
}

function Note({ label, onPass }: { label: string; onPass: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2">
      <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What cleared it" />
      <button type="button" disabled={note.trim().length < 8} className="bg-[#1a1714] px-4 py-2 text-sm text-[#f3efe6] disabled:opacity-40" onClick={() => onPass(note)}>{label}</button>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
