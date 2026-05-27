import { PrimaryButton } from "./PrimaryButton";
import { MetricCard } from "./MetricCard";
import { launchDate, stats } from "./section-data";

const daysLeft = Math.max(0, Math.ceil((launchDate.getTime() - Date.now()) / 86400000));

export function HeroSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-cyan-300">AuthiChain</p>
          <h1 className="max-w-xl text-5xl font-semibold tracking-tight sm:text-6xl">
            Verify everything with on-chain trust.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-zinc-300">
            AuthiChain gives brands a fast, public verification layer for product authenticity, scan receipts, and supply-chain proof.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <PrimaryButton href="#pricing">View pricing</PrimaryButton>
            <PrimaryButton href="#footer" variant="outline">Request access</PrimaryButton>
          </div>
          <p className="mt-6 text-sm text-zinc-400">
            Launch target: {launchDate.toISOString().slice(0, 10)} · {daysLeft} days remaining
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat) => (
              <MetricCard key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
