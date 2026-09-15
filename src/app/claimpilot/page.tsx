import { CalendarClock, CheckCircle2, Search, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';

const claims = [
  { name: 'Privacy & Data Settlement', category: 'Privacy', score: 97, proof: 'No documentation', deadline: '14 days', value: '$25–$85', status: 'Ready to review' },
  { name: 'Consumer Subscription Settlement', category: 'Consumer', score: 93, proof: 'No documentation', deadline: '23 days', value: '$15–$60', status: 'Ready to review' },
  { name: 'Payment Processing Settlement', category: 'Payments', score: 88, proof: 'Low', deadline: '41 days', value: '$40–$180', status: 'Needs one fact' },
  { name: 'Product Warranty Settlement', category: 'Products', score: 74, proof: 'Receipt may help', deadline: '67 days', value: '$50–$250', status: 'Needs review' },
];

export default function ClaimPilotPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-amber-400 font-black text-slate-950">CP</div><div><h1 className="text-xl font-bold">ClaimPilot</h1><p className="text-xs text-slate-400">Personal claims recovery OS</p></div></div>
          <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300"><ShieldCheck className="mr-1 inline size-3.5" /> Evidence-first mode</div>
        </header>

        <section className="mb-5 grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="mb-3 inline-flex items-center gap-1 rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300"><Sparkles className="size-3.5" /> Discovery engine</div>
            <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Find money you can legitimately claim.</h2>
            <p className="mt-3 max-w-3xl leading-7 text-slate-400">Discover settlements, verify official sources, match eligibility rules, separate no-proof claims from documented claims, and keep every deadline in one place.</p>
            <div className="mt-5 flex flex-wrap gap-2"><button className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950"><Search className="mr-1 inline size-4" /> Scan for new claims</button><button className="rounded-lg border border-slate-700 px-4 py-2 text-sm">No proof only</button><button className="rounded-lg border border-slate-700 px-4 py-2 text-sm">High confidence</button></div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><p className="text-xs text-slate-500">Opportunity floor</p><p className="mt-2 text-4xl font-black">$130+</p><p className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs leading-5 text-slate-400">Estimates are informational, not guaranteed payouts. ClaimPilot never invents qualifying facts or evidence.</p></div>
        </section>

        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Open matches','17',''],['No-proof matches','9','text-emerald-300'],['Ready to review','6',''],['Deadlines ≤ 14d','3','text-amber-300']].map(([label,value,cls])=><div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs text-slate-500">{label}</p><p className={`mt-2 text-3xl font-extrabold ${cls}`}>{value}</p></div>)}</section>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="mb-2 flex items-center justify-between"><h3 className="font-bold">Claim queue</h3><span className="text-xs text-slate-500">Value / effort</span></div>{claims.map(c=><article key={c.name} className="grid grid-cols-[1fr_auto] gap-4 border-t border-slate-800 py-4 first:border-t-0"><div><h4 className="text-sm font-semibold">{c.name}</h4><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">{c.category}</span><span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">{c.proof}</span><span className="text-slate-400"><CalendarClock className="mr-1 inline size-3.5" />{c.deadline}</span></div><p className="mt-2 text-xs text-slate-500">{c.status} · Official source verification required</p></div><div className="text-right"><p className={`font-extrabold ${c.score>=90?'text-emerald-300':c.score>=70?'text-amber-300':'text-rose-300'}`}>{c.score}%</p><p className="my-1 text-xs">{c.value}</p><button className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs">Review</button></div></article>)}</section>
          <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="mb-5 flex items-center justify-between"><h3 className="font-bold">Deadline engine</h3><CalendarClock className="size-5" /></div><div className="relative ml-2 border-l border-slate-700 pl-5">{[['Today','Review 2 prepared claims'],['In 7 days','3 claims enter urgent window'],['In 14 days','Privacy & Data Settlement'],['In 23 days','Consumer Subscription Settlement']].map(([when,what])=><div key={when} className="relative mb-6"><span className="absolute -left-[26px] top-1 size-2.5 rounded-full bg-amber-400"/><p className="text-sm font-semibold">{when}</p><p className="text-xs text-slate-500">{what}</p></div>)}</div><div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs leading-5 text-slate-400"><WalletCards className="mr-1 inline size-4" /> Payment tracking is modeled now; browser submission is intentionally disabled until the data model is proven.</div></aside>
        </div>
        <div className="mt-5 flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 className="size-4" /> MVP v0.1 · Discovery → verification → eligibility → claim queue → deadline engine</div>
      </div>
    </main>
  );
}
