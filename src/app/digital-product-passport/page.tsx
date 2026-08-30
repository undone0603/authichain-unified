"use client";

import { useState } from "react";
import Link from "next/link";
import { DppCountdown } from "@/components/DppCountdown";
import { useNow } from "@/lib/use-now";
import {
  listMilestones,
  milestoneStatus,
  formatMilestoneDate,
  nextDeadline,
  mostRecentInForce,
  timelineUpdatedAt,
  type Milestone,
} from "@/lib/dpp-timeline";
import {
  ShieldCheck,
  BarChart3,
  Leaf,
  Hammer,
  Truck,
  Recycle,
  ArrowRight,
  Sparkles,
  Zap,
  Lock,
  Activity,
  CheckCircle,
  Database,
  Globe,
  WifiOff,
  AlertTriangle,
  Battery,
} from "lucide-react";

export default function DPPPage() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState<number>(0);

  // Which milestone leads the page is decided by the calendar, not by whoever
  // last edited this file. `nextDeadline` moves on by itself as dates pass, so
  // the page stops advertising a mandate it has already crossed.
  const milestones = listMilestones();
  const now = useNow(timelineUpdatedAt());

  const statusOf = (m: Milestone) => milestoneStatus(m, now);
  const nextMilestone = nextDeadline(now);
  const liveMilestone = mostRecentInForce(now);
  const registryMilestone =
    milestones.find(m => m.id === "central-registry") ?? null;
  const registryVerb =
    registryMilestone && milestoneStatus(registryMilestone, now) === "in-force"
      ? "opened"
      : "opens";

  const startDemo = () => {
    setIsSimulating(true);
    setSimStep(1);
    setTimeout(() => setSimStep(2), 1500);
    setTimeout(() => setSimStep(3), 3000);
    setTimeout(() => {
      setIsSimulating(false);
      setSimStep(4);
    }, 4500);
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gold/5 blur-[120px] rounded-full opacity-50" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            <Globe className="w-4 h-4" />
            {liveMilestone ? (
              <>
                EU ESPR · {liveMilestone.label} —{" "}
                <DppCountdown milestone={liveMilestone} />
              </>
            ) : (
              <>EU ESPR Digital Product Passport</>
            )}
          </div>

          {/* Next mandate. Label and countdown both come from
              content/dpp/regulatory-timeline.json, so this banner retires itself
              and moves to the next milestone as each deadline passes. */}
          {nextMilestone && (
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-8 ${
                nextMilestone.urgent
                  ? "bg-red-500/10 border border-red-500/20 text-red-400"
                  : "bg-zinc-500/10 border border-zinc-700 text-zinc-400"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {nextMilestone.label}: {formatMilestoneDate(nextMilestone)} —{" "}
              <DppCountdown milestone={nextMilestone} />
            </div>
          )}

          <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter uppercase leading-[0.9]">
            The Standard For <br />
            <span className="gold-text">Industrial</span> Passports
          </h1>

          {/* "the only platform that meets every ESPR requirement" was an
              unverifiable absolute; the offline claim below is specific and
              checkable, which is the stronger sentence anyway. The registry
              date is no longer written in the future tense by hand. */}
          <p className="max-w-2xl mx-auto text-zinc-400 text-lg md:text-xl font-medium mb-4 leading-relaxed">
            {registryMilestone && (
              <>
                The EU Digital Product Passport registry {registryVerb}{" "}
                {formatMilestoneDate(registryMilestone)}.{" "}
              </>
            )}
            AuthiChain issues ESPR-aligned passports that verify{" "}
            <span className="text-white font-bold">
              with no internet connection
            </span>{" "}
            — the signature checks against the issuer&apos;s published key, not
            against our servers.
          </p>
          <p className="max-w-xl mx-auto text-zinc-600 text-sm font-bold uppercase tracking-widest mb-12">
            Works at factory floors, border crossings, and disconnected
            industrial sites.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={startDemo}
              disabled={isSimulating}
              className="btn-gold px-12 py-5 font-black uppercase tracking-widest text-xs shadow-gold"
            >
              {isSimulating
                ? "Processing Compliance..."
                : "Simulate BMW Battery Passport"}
            </button>
            <Link
              href="/book"
              className="btn-outline-gold px-12 py-5 font-black uppercase tracking-widest text-xs border-zinc-800"
            >
              Apply for Pilot <ArrowRight className="inline w-4 h-4 ml-2" />
            </Link>
          </div>

          {/* New Trust Row */}
          <div className="mt-20 flex flex-col items-center">
            {/* ESPR is Regulation (EU) 2024/1781 — this read 2024/1789, a
                 wrong citation on the page whose whole subject is that
                 regulation, and the first thing a compliance reader would
                 check. "Aligned with" rather than "compliant": conformance is
                 assessed per product, not asserted by a vendor. */}
            <div className="flex items-center gap-6 text-[9px] font-black uppercase tracking-[0.4em] text-zinc-700 mb-8">
              <span>Polygon Anchored</span>
              <div className="w-1 h-1 rounded-full bg-zinc-800" />
              <span>Ed25519 Secured</span>
              <div className="w-1 h-1 rounded-full bg-zinc-800" />
              <a
                href="https://eur-lex.europa.eu/eli/reg/2024/1781/oj"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-400 underline underline-offset-4"
              >
                Aligned to EU 2024/1781
              </a>
            </div>
            {/* "1.2M Assets / Day" was a throughput figure nobody benchmarked.
                 What replaces it is checkable by anyone, without an account. */}
            <div className="px-10 py-5 rounded-3xl bg-zinc-950 border border-zinc-900 inline-flex flex-wrap items-center justify-center gap-10">
              <div className="text-left sm:border-r border-zinc-900 sm:pr-10">
                <p className="text-[10px] font-black text-gold uppercase tracking-widest mb-1">
                  Verification
                </p>
                <p className="text-2xl font-black text-white tracking-tighter">
                  Offline{" "}
                  <span className="text-zinc-600 font-medium text-xs tracking-normal uppercase ml-1">
                    No Account Required
                  </span>
                </p>
              </div>
              <Link
                href="/protocol"
                className="flex items-center gap-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest hover:text-gold transition-colors"
              >
                <Activity className="w-4 h-4 text-gold" />
                Apache-2.0 Spec &amp; Verifier
              </Link>
            </div>
          </div>
        </div>

        {/* Demo Overlay */}
        {(isSimulating || simStep === 4) && (
          <div className="max-w-4xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="protocol-card p-10 bg-zinc-950 border-gold/20 relative overflow-hidden">
              <div className="flex justify-between items-start mb-12">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">
                    BMW-BAT-992-X{" "}
                    <span className="text-gold italic ml-2">PASSPORT</span>
                  </h3>
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                    Type: Industrial High-Voltage Battery • Series: M-Edition
                  </p>
                </div>
                {simStep === 4 && (
                  <div className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle className="w-3 h-3" /> Compliance Verified
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-3 opacity-60">
                    <Activity
                      className={`w-4 h-4 ${simStep >= 1 ? "text-gold" : "text-zinc-700"}`}
                    />
                    <span
                      className={`text-[10px] font-black uppercase ${simStep >= 1 ? "text-white" : "text-zinc-800"}`}
                    >
                      1. Environmental Ingest
                    </span>
                  </div>
                  <div className="flex items-center gap-3 opacity-60">
                    <Database
                      className={`w-4 h-4 ${simStep >= 2 ? "text-gold" : "text-zinc-700"}`}
                    />
                    <span
                      className={`text-[10px] font-black uppercase ${simStep >= 2 ? "text-white" : "text-zinc-800"}`}
                    >
                      2. State Hash Compute
                    </span>
                  </div>
                  <div className="flex items-center gap-3 opacity-60">
                    <Lock
                      className={`w-4 h-4 ${simStep >= 3 ? "text-gold" : "text-zinc-700"}`}
                    />
                    <span
                      className={`text-[10px] font-black uppercase ${simStep >= 3 ? "text-white" : "text-zinc-800"}`}
                    >
                      3. Polygon Anchor
                    </span>
                  </div>
                </div>

                <div className="md:col-span-2 bg-black rounded-2xl p-6 font-mono text-[10px] leading-loose border border-zinc-900">
                  {simStep >= 1 && (
                    <p className="text-zinc-500">
                      &gt; FETCHING METRICS: Capacity=84Ah, Health=99.2%,
                      Cycles=12
                    </p>
                  )}
                  {simStep >= 2 && (
                    <p className="text-zinc-400">
                      &gt; GENERATING STATE HASH: 0x7a2d...8c9d
                    </p>
                  )}
                  {simStep >= 3 && (
                    <p className="text-gold">
                      &gt; ANCHORING SUCCESSFUL: BLOCK #4,102,884
                    </p>
                  )}
                  {simStep === 4 && (
                    <p className="text-green-500">
                      &gt; PROTOCOL HANDSHAKE COMPLETE. DPP ACTIVE.
                    </p>
                  )}
                  {!isSimulating && simStep === 0 && (
                    <p className="text-zinc-800 italic animate-pulse">
                      Waiting for simulation trigger...
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Compliance Timeline */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="flex items-center gap-3 mb-12">
          <div className="h-px flex-1 bg-zinc-900" />
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">
            Compliance Timeline
          </h2>
          <div className="h-px flex-1 bg-zinc-900" />
        </div>

        {/* Driven entirely by content/dpp/regulatory-timeline.json. Rows
            re-sort and re-style themselves as dates pass, and each carries the
            source a reader can check. */}
        <div className="space-y-4">
          {milestones.map(item => {
            const status = statusOf(item);
            const inForce = status === "in-force";
            const imminent = status === "imminent";
            return (
              <div
                key={item.id}
                className={`protocol-card p-6 flex flex-wrap gap-4 justify-between items-center ${
                  imminent && item.urgent
                    ? "bg-red-500/5 border-red-500/30"
                    : inForce
                      ? "bg-gold/5 border-gold/20"
                      : "opacity-60"
                }`}
              >
                <div className="flex items-center gap-6 min-w-0">
                  <span
                    className={`text-sm font-black uppercase tracking-widest whitespace-nowrap ${
                      imminent && item.urgent
                        ? "text-red-400"
                        : inForce
                          ? "text-gold"
                          : "text-zinc-600"
                    }`}
                  >
                    {formatMilestoneDate(item)}
                  </span>
                  <span className="text-sm font-bold text-zinc-300 uppercase">
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest">
                  <span
                    className={
                      imminent && item.urgent
                        ? "text-red-400"
                        : inForce
                          ? "text-gold"
                          : "text-zinc-600"
                    }
                  >
                    <DppCountdown milestone={item} />
                  </span>
                  <a
                    href={item.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-600 hover:text-zinc-300 underline underline-offset-4"
                  >
                    Source
                  </a>
                  {inForce && <Sparkles className="w-4 h-4 text-gold" />}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
          Timeline last reviewed {timelineUpdatedAt()}. Countdowns are computed
          from today&apos;s date.
        </p>
      </section>

      {/* ── ESPR Requirements ─────────────────────────────────────── */}
      <section className="bg-zinc-950 border-y border-zinc-900 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gold mb-4">
              ESPR Compliance
            </p>
            <h2 className="text-4xl font-black uppercase tracking-tighter">
              Every Requirement. <span className="gold-text">Checked.</span>
            </h2>
            <p className="text-zinc-500 text-sm mt-4 max-w-lg mx-auto">
              EU ESPR mandates that DPP data be accessible, verifiable, and
              tamper-evident. AuthiChain exceeds the spec — adding what no
              competitor can match.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-20">
            {[
              {
                label: "Accessible",
                desc: "GS1 Digital Link–compatible unique product identifier, queryable via the EU Central Registry from day one.",
                exclusive: false,
              },
              {
                label: "Verifiable",
                desc: "Ed25519 cryptographic signature on every data record — mathematically provable, no central trust required.",
                exclusive: false,
              },
              {
                label: "Tamper-Evident",
                desc: "Every passport hashed and anchored on Polygon — any alteration is permanently detectable on-chain.",
                exclusive: false,
              },
              {
                label: "Offline-Capable",
                desc: "AuthiChain-exclusive: full cryptographic verification with zero internet. Works at mines, factories, and border crossings where competitors fail.",
                exclusive: true,
              },
            ].map(req => (
              <div
                key={req.label}
                className={`protocol-card p-8 ${req.exclusive ? "border-gold/30 bg-gold/5" : ""}`}
              >
                <div className="flex items-start gap-4">
                  <CheckCircle
                    className={`w-6 h-6 mt-0.5 flex-shrink-0 ${req.exclusive ? "text-gold" : "text-green-500"}`}
                  />
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-black uppercase tracking-tight text-white">
                        {req.label}
                      </h3>
                      {req.exclusive && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-gold/20 text-gold border border-gold/30">
                          Exclusive
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-sm leading-relaxed">
                      {req.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Offline callout */}
          <div className="flex flex-col md:flex-row items-center gap-10 p-10 rounded-3xl border border-gold/20 bg-gold/5">
            <div className="flex-shrink-0 text-center">
              <WifiOff className="w-16 h-16 text-gold mx-auto mb-3" />
              <p className="text-[10px] font-black uppercase tracking-widest text-gold">
                Only AuthiChain
              </p>
            </div>
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tighter mb-4">
                Verification Breaks Without Signal.{" "}
                <span className="gold-text">Not Anymore.</span>
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                Battery factories, mining operations and logistics hubs often
                have no signal. Where verification depends on reaching a
                vendor&apos;s server, a scan can complete while the verification
                behind it silently fails.
              </p>
              <p className="text-zinc-400 text-sm leading-relaxed">
                AuthiChain&apos;s Ed25519 verification runs entirely on-device,
                checking the signature against the issuer&apos;s published key.
                No server, no connectivity, no account. The reference verifier
                is Apache-2.0 — run it yourself and confirm it never opens a
                socket.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Competitor Comparison ──────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gold mb-4">
            Competitive Landscape
          </p>
          <h2 className="text-4xl font-black uppercase tracking-tighter">
            Why AuthiChain <span className="gold-text">Wins</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-4 pr-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Provider
                </th>
                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">
                  Offline Verify
                </th>
                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">
                  Industrial
                </th>
                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">
                  AI Layer
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  name: "Scantrust",
                  focus: "Consumer QR / Brand Protection",
                  offline: false,
                  industrial: false,
                  ai: false,
                  highlight: false,
                },
                {
                  name: "VeChain",
                  focus: "Enterprise Blockchain",
                  offline: false,
                  industrial: true,
                  ai: false,
                  highlight: false,
                },
                {
                  name: "Circularise",
                  focus: "Circular Economy / Plastics",
                  offline: false,
                  industrial: false,
                  ai: false,
                  highlight: false,
                },
                {
                  name: "AuthiChain",
                  focus: "Industrial Supply Chain AI + Blockchain",
                  offline: true,
                  industrial: true,
                  ai: true,
                  highlight: true,
                },
              ].map(c => (
                <tr
                  key={c.name}
                  className={`border-b ${c.highlight ? "border-gold/20 bg-gold/5" : "border-zinc-900"}`}
                >
                  <td className="py-5 pr-8">
                    <p
                      className={`font-black uppercase tracking-tight ${c.highlight ? "text-gold text-base" : "text-zinc-400 text-sm"}`}
                    >
                      {c.name}
                    </p>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-tighter mt-0.5">
                      {c.focus}
                    </p>
                  </td>
                  <td className="py-5 px-4 text-center">
                    {c.offline ? (
                      <CheckCircle className="w-5 h-5 text-green-400 mx-auto" />
                    ) : (
                      <span className="text-zinc-700 font-black text-lg">
                        —
                      </span>
                    )}
                  </td>
                  <td className="py-5 px-4 text-center">
                    {c.industrial ? (
                      <CheckCircle className="w-5 h-5 text-green-400 mx-auto" />
                    ) : (
                      <span className="text-zinc-700 font-black text-lg">
                        —
                      </span>
                    )}
                  </td>
                  <td className="py-5 px-4 text-center">
                    {c.ai ? (
                      <CheckCircle className="w-5 h-5 text-green-400 mx-auto" />
                    ) : (
                      <span className="text-zinc-700 font-black text-lg">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Industrial Capabilities Grid */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-black uppercase tracking-tight text-center mb-16">
          Enterprise <span className="gold-text">Protocol</span> Requirements
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: BarChart3,
              title: "Unique Identity",
              desc: "Serialized identifiers for every unit, linked to an immutable blockchain record.",
            },
            {
              icon: Leaf,
              title: "Carbon Footprint",
              desc: "Lifecycle emissions data from raw materials through manufacturing and transport.",
            },
            {
              icon: Recycle,
              title: "Material Composition",
              desc: "Full bill of materials (BOM), recycled content, and hazardous substance declarations.",
            },
            {
              icon: Hammer,
              title: "Repairability",
              desc: "Digital repair manuals, spare parts availability, and expected product lifetime.",
            },
            {
              icon: Truck,
              title: "Supply Chain",
              desc: "Auditable chain of custody from source to shelf, anchored on the Polygon network.",
            },
            {
              icon: Leaf,
              title: "Seed to Sale",
              desc: "Specialized provenance for agriculture and high-value strains, tracking every batch and harvest.",
            },
            {
              icon: ShieldCheck,
              title: "Regulatory Export",
              desc: "Instant generation of EU-compliant JSON/XML data formats for registry submission.",
            },
            {
              icon: Zap,
              title: "Real-Time Throughput",
              desc: "Sub-second response times for query and verification operations at industrial scale — engineered for 1M+ daily anchors.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="protocol-card p-8 group hover:border-gold/40 transition-all"
            >
              <item.icon className="w-8 h-8 text-gold mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-black uppercase tracking-tight mb-3">
                {item.title}
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed uppercase tracking-tighter">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-zinc-950 border-y border-zinc-900 py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-[0.3em] mb-8">
            <Battery className="w-4 h-4" />
            Battery Compliance Pilot — 10 Slots Available
          </div>
          <h2 className="text-4xl font-black mb-6 uppercase tracking-tighter leading-none">
            Be Compliant <br />
            <span className="gold-text">
              {nextMilestone
                ? `Before ${formatMilestoneDate(nextMilestone)}`
                : "Ahead Of The Mandate"}
            </span>
          </h2>
          <p className="text-zinc-400 mb-4 max-w-xl mx-auto leading-relaxed">
            We&apos;re onboarding battery manufacturers and tier-1 suppliers for
            our EU DPP pilot. Full ESPR compliance, offline verification, and
            GS1 registry integration — operational in 90 days.
          </p>
          <p className="text-zinc-600 mb-12 uppercase tracking-widest text-xs font-bold">
            Programmatic generation for 1M+ units per day.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/book"
              className="btn-gold inline-flex items-center gap-3 px-10 py-4 font-black uppercase tracking-widest text-xs shadow-gold"
            >
              Apply for the Pilot <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="mailto:z@authichain.com?subject=EU DPP Pilot"
              className="btn-outline-gold inline-flex items-center gap-3 px-10 py-4 font-black uppercase tracking-widest text-xs border-zinc-800"
            >
              Email Directly
            </a>
          </div>
        </div>
      </section>

      {/* Footer Navigation */}
      <footer className="py-12 px-6 border-t border-zinc-900 mt-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 opacity-40 hover:opacity-100 transition-opacity">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            &copy; 2026 AuthiChain Protocol ◆ Industrial Division
          </p>
          <div className="flex gap-6 flex-wrap justify-center">
            <Link
              href="/compliance"
              className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors"
            >
              Compliance
            </Link>
            <Link
              href="/hardware"
              className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors"
            >
              Hardware
            </Link>
            <Link
              href="/partners"
              className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors"
            >
              Partners
            </Link>
            <span className="text-zinc-800">|</span>
            <Link
              href="/terms"
              className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/gallery"
              className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors"
            >
              Gallery
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
