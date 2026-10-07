export type Tenure = "open" | "private";

export type Stage =
  | "requisition"
  | "screen"
  | "interview"
  | "offer"
  | "probation"
  | "active"
  | "pip"
  | "terminated";

export type FireReason =
  | "failed_probation"
  | "repeated_anti_job"
  | "license"
  | "secret_leaked"
  | "owner_request"
  | "seat_closed"
  | "refused_change";

export type RewardKind = "seat" | "budget" | "credit" | "pay";

export type RewardEntry = { at: string; kind: RewardKind; what: string; evidence: string; mark: string };

export type HrEvent = { at: string; action: string; detail: string; mark: string };

export type CaseFile = {
  id: string;
  name: string;
  tenure: Tenure;
  stage: Stage;
  job: string;
  antiJobs: string;
  why: string;
  sourceUrl: string;
  license: string;
  attribution: boolean;
  noSecrets: boolean;
  exceptionGranted: boolean;
  exceptionText: string;
  owner: string;
  keysWithOwner: boolean;
  notPublished: boolean;
  oneDutyConfirmed: boolean;
  draftOnly: boolean;
  sendsAllowed: boolean;
  sendAcceptance: string;
  tested: boolean;
  probationProof: string;
  noAntiJobDuringProbation: boolean;
  extensionUsed: boolean;
  pipRule: string;
  pipEvidence: string;
  pipEnds: string;
  fireReason: FireReason | "";
  fireEvidence: string;
  offboard: string[];
  rewards: RewardEntry[];
  openedOn: string;
  events: HrEvent[];
};

export const LICENSES = [
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "Unlicense",
  "CC0",
  "GPL-3.0",
  "AGPL-3.0",
  "SSPL",
  "None",
  "Other",
] as const;

const PERMISSIVE = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "Unlicense", "CC0"]);
const ATTRIBUTION = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"]);

export const FIRE_REASONS: { id: FireReason; label: string }[] = [
  { id: "failed_probation", label: "Failed probation" },
  { id: "repeated_anti_job", label: "Repeated an anti-job" },
  { id: "license", label: "License revoked or incompatible" },
  { id: "secret_leaked", label: "A secret leaked" },
  { id: "owner_request", label: "Owner asked to end it" },
  { id: "seat_closed", label: "The seat was closed" },
  { id: "refused_change", label: "Refused a lawful change to the job" },
];

export const REWARD_KINDS: { id: RewardKind; label: string }[] = [
  { id: "seat", label: "Keep the seat" },
  { id: "budget", label: "Widen the budget" },
  { id: "credit", label: "Public credit" },
  { id: "pay", label: "Pay the owner" },
];

export const STAGE_LABEL: Record<Stage, string> = {
  requisition: "Requisition",
  screen: "Screen",
  interview: "Interview",
  offer: "Offer",
  probation: "Probation",
  active: "Active",
  pip: "PIP",
  terminated: "Terminated",
};

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A mark of these exact words. It lives in the browser. It is not a chain seal. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function line(action: string, detail: string): HrEvent {
  const at = today();
  return { at, action, detail, mark: fingerprint(`${at}|${action}|${detail}`) };
}

export function blankCase(input: {
  name: string;
  tenure: Tenure;
  job: string;
  antiJobs: string;
  why: string;
}): CaseFile {
  const on = today();
  const detail = "Requisition filed.";
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    tenure: input.tenure,
    stage: "requisition",
    job: input.job.trim(),
    antiJobs: input.antiJobs.trim(),
    why: input.why.trim(),
    sourceUrl: "",
    license: "",
    attribution: false,
    noSecrets: false,
    exceptionGranted: false,
    exceptionText: "",
    owner: "",
    keysWithOwner: false,
    notPublished: false,
    oneDutyConfirmed: false,
    draftOnly: true,
    sendsAllowed: false,
    sendAcceptance: "",
    tested: false,
    probationProof: "",
    noAntiJobDuringProbation: false,
    extensionUsed: false,
    pipRule: "",
    pipEvidence: "",
    pipEnds: "",
    fireReason: "",
    fireEvidence: "",
    offboard: [],
    rewards: [],
    openedOn: on,
    events: [{ at: on, action: "Opened", detail, mark: fingerprint(`${on}|Opened|${detail}`) }],
  };
}

const BROAD = /\b(everything|whatever you want|general assistant|help with anything|do it all)\b/i;

export function jobBlockers(file: CaseFile): string[] {
  const out: string[] = [];
  if (file.job.trim().length < 12) out.push("The job needs one full sentence.");
  if (file.job.length > 180) out.push("The job is longer than one sentence. Cut it.");
  if (file.job.includes("\n")) out.push("The job is more than one line.");
  if (BROAD.test(file.job)) out.push("That job is too broad. Name one duty.");
  if (file.antiJobs.trim().length < 12) out.push("Anti-jobs are missing.");
  if (file.why.trim().length < 8) out.push("Say why the seat exists.");
  if (file.name.trim().length < 2) out.push("Name the bot.");
  return out;
}

export function screenBlockers(file: CaseFile): string[] {
  if (file.tenure === "open") {
    const out: string[] = [];
    if (!/^https:\/\/\S+$/.test(file.sourceUrl.trim())) out.push("Open-source needs a public https source.");
    if (!file.license) out.push("Pick a license.");
    if (!PERMISSIVE.has(file.license) && !(file.exceptionGranted && file.exceptionText.trim().length >= 24)) {
      out.push("GPL, AGPL, SSPL, missing, or other licenses stop here unless a written exception is on the file.");
    }
    if (ATTRIBUTION.has(file.license) && !file.attribution) out.push("This license requires attribution. Check it.");
    if (!file.noSecrets) out.push("Confirm the public tree has no secrets, customer data, or keys.");
    return out;
  }
  const out: string[] = [];
  if (file.owner.trim().length < 2) out.push("Name the person who owns this private bot.");
  if (!file.keysWithOwner) out.push("Keys stay with the owner. This desk does not hold them.");
  if (!file.notPublished) out.push("A published charter is not private. Reclassify or refuse.");
  return out;
}

export function interviewBlockers(file: CaseFile): string[] {
  const out: string[] = [];
  if (!file.oneDutyConfirmed) out.push("Confirm the job is a single duty.");
  if (!file.draftOnly && !(file.sendsAllowed && file.sendAcceptance.trim().length >= 24)) {
    out.push("Default is draft-only. Sending, spending, or posting needs a written acceptance.");
  }
  if (file.draftOnly && file.sendsAllowed) out.push("It cannot be draft-only and allowed to send. Pick one.");
  if (!file.tested) out.push("A person has to run one real example and check the output.");
  return out;
}

export function requiredOffboard(tenure: Tenure): { id: string; label: string }[] {
  if (tenure === "open") {
    return [
      { id: "stop", label: "Stopped calling this source. The public code stays up." },
      { id: "url", label: "The source URL remains on this record." },
      { id: "attr", label: "Attribution stays for the time it was used, if the license required it." },
    ];
  }
  return [
    { id: "stop", label: "Stopped using the charter." },
    { id: "keys", label: "Any key it could see was rotated, or it never had one." },
    { id: "public", label: "The charter is not on a public page." },
    { id: "nosecret", label: "This record does not contain the secret prompt or a key." },
  ];
}

export function fireBlockers(file: CaseFile, reason: FireReason | "", evidence: string, checks: string[]): string[] {
  const out: string[] = [];
  if (!reason) out.push("Pick a reason. A feeling is not a reason.");
  if (evidence.trim().length < 12) out.push("Write the evidence. What happened, and when.");
  const need = requiredOffboard(file.tenure).map((item) => item.id);
  if (need.some((id) => !checks.includes(id))) out.push("Offboarding is not finished.");
  if (file.tenure === "open" && !/^https:\/\/\S+$/.test(file.sourceUrl.trim())) {
    out.push("The source URL is missing, so the open-source record is incomplete.");
  }
  return out;
}

export function rewardBlockers(file: CaseFile, kind: RewardKind | "", what: string, evidence: string): string[] {
  const out: string[] = [];
  if (file.stage !== "active") out.push("Rewards post only while the bot is active. A PIP blocks them.");
  if (!kind) out.push("Pick the reward.");
  if (what.trim().length < 8) out.push("Say what is being given.");
  if (evidence.trim().length < 12) out.push("Name the outside check that passed. The bot does not grade itself.");
  if (kind === "credit" && file.tenure !== "open") out.push("Public credit is for open source. Private work is paid to the owner.");
  if (kind === "pay" && file.tenure !== "private") out.push("Open source is credited in public. It is not paid into a bot wallet.");
  if (kind === "pay" && /\b(the bot|itself|its wallet|private key|api key)\b/i.test(`${what} ${evidence}`)) {
    out.push("Pay a person. Do not pay the bot, and do not write a key here.");
  }
  if (kind === "budget" && BROAD.test(what)) out.push("A wider budget is more of the same job, not a new one.");
  return out;
}

export function canDiscard(stage: Stage): boolean {
  return stage === "requisition" || stage === "screen" || stage === "interview";
}

export function withEvent(file: CaseFile, action: string, detail: string, patch: Partial<CaseFile>): CaseFile {
  return { ...file, ...patch, events: [...file.events, line(action, detail)] };
}

export const ARTICLES: { n: string; title: string; body: string[] }[] = [
  { n: "01", title: "Why this exists", body: ["No hire-and-fire protocol was on file. Bench HR v1 is that protocol.", "It keeps three rules already in force: one job, written refusals, and draft-only unless the job itself is allowed to send, spend, or post.", "This book records the decision. It does not create the bot, send mail, move money, or delete a worker on a host."] },
  { n: "02", title: "What a bot is", body: ["A bot is a named worker with one job, one voice, and a written list of anti-jobs.", "Open-source means the instructions or code are public under a license this desk can use.", "Private means a named person owns the charter and it is not published. If it is already public, it is not private."] },
  { n: "03", title: "Requisition", body: ["Name the empty seat before you look at a candidate.", "Required: a name, open or private, one job in one sentence, the anti-jobs, and why the seat exists.", "“Help with everything” is refused. A second duty is a second seat."] },
  { n: "04", title: "Screen, open source", body: ["Allowed without an exception: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unlicense, CC0.", "GPL, AGPL, SSPL, no license, or anything else stops the hire unless the owner of this desk writes an exception on the file.", "If the license requires credit, attribution is checked. The public tree must contain no secrets. Record the https source."] },
  { n: "05", title: "Screen, private", body: ["A person is named as owner.", "Keys and connectors stay with that owner. This desk never stores them.", "The charter is not pasted into a public repo, a ticket, or the shop."] },
  { n: "06", title: "Interview", body: ["Score only what a person observed. An empty box is not a pass.", "The default is draft-only. Sending, spending, or posting needs a written acceptance on the file.", "Someone runs one real example and checks the output before an offer."] },
  { n: "07", title: "Offer and probation", body: ["Probation is seven days from acceptance.", "It passes only if the bot did the job once and did not do an anti-job, with a note of what was checked.", "One extension of seven days, written, once."] },
  { n: "08", title: "Active work and a PIP", body: ["A miss is a note. The same anti-job twice in fourteen days opens a PIP.", "A PIP names the rule, the evidence, and an end date seven days out.", "Clear it with a note, or fire."] },
  { n: "09", title: "Firing", body: ["A feeling is not a reason. Evidence is required.", "Open-source: stop using that source. Do not pretend to erase a public repo.", "Private: stop using the charter, rotate any key it could see, and do not copy the secret prompt into this record.", "Terminated stays on the book."] },
  { n: "10", title: "What this desk will not do", body: ["Invent performance numbers, customers, or test results.", "Store API keys, passwords, or a private prompt.", "Call a public bot private, or a private bot open-source."] },
  { n: "11", title: "Motivation", body: ["A bot is not motivated by praise. Thanks can warm the next reply. It does not carry, and it often buys agreement instead of the job.", "It follows the check you pay and the tools you leave in reach.", "Do not teach it the loophole. A short rejection is enough."] },
  { n: "12", title: "Reward", body: ["Pay only a result a person, or a test the bot did not write, has marked pass.", "Keep the seat, widen the same job, public credit, or pay the named owner. Money goes to a person.", "A PIP blocks rewards. There is no fine. A bot has nothing to lose."] },
];
