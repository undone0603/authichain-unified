"use client";

import { useMemo, useState } from "react";

const CITIES = [
  ["Traverse City, MI", "44.7631", "-85.6206", "America/Detroit"],
  ["Grand Rapids, MI", "42.9634", "-85.6681", "America/Detroit"],
  ["Chicago, IL", "41.8781", "-87.6298", "America/Chicago"],
  ["New York, NY", "40.7128", "-74.0060", "America/New_York"],
  ["Los Angeles, CA", "34.0522", "-118.2437", "America/Los_Angeles"],
  ["Austin, TX", "30.2672", "-97.7431", "America/Chicago"],
];

export default function StarmapPage() {
  const [dateISO, setDateISO] = useState("2019-06-14");
  const [time, setTime] = useState("22:00");
  const [placeLabel, setPlaceLabel] = useState(CITIES[0][0]);
  const [lat, setLat] = useState(Number(CITIES[0][1]));
  const [lon, setLon] = useState(Number(CITIES[0][2]));
  const [tz, setTz] = useState(CITIES[0][3]);
  const [dedication, setDedication] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const caption = useMemo(() => `The sky over ${placeLabel} · ${dateISO}`, [placeLabel, dateISO]);
  const payload = () => ({ dateISO, time, lat, lon, tz, placeLabel, dedication, style: "navy-gold" as const });

  async function generatePreview() {
    setBusy(true);
    try {
      const res = await fetch("/api/starmap/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload(), sku: "preview" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreview(data.png);
    } finally { setBusy(false); }
  }

  async function checkout(sku: "digital" | "portal" | "certified") {
    setBusy(true);
    try {
      const res = await fetch("/api/starmap/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload(), sku }) });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed");
      window.location.href = data.url;
    } finally { setBusy(false); }
  }

  function selectCity(value: string) {
    const city = CITIES.find(c => c[0] === value);
    if (!city) return;
    setPlaceLabel(city[0]); setLat(Number(city[1])); setLon(Number(city[2])); setTz(city[3]);
  }

  return (
    <main className="min-h-screen bg-[#050811] text-white">
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="mb-4 text-sm uppercase tracking-[0.35em] text-amber-300">QRON · NIGHTSTAMP</p>
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">The sky that night. Scannable forever.</h1>
          <p className="mt-6 max-w-xl text-lg text-slate-300">A real-time star field wrapped around a QR memory portal. Your date, your place, your story.</p>
          <div className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <label>Date<input type="date" value={dateISO} onChange={e => setDateISO(e.target.value)} /></label>
            <label>Time<input type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
            <label>City<input list="nightstamp-cities" value={placeLabel} onChange={e => { setPlaceLabel(e.target.value); selectCity(e.target.value); }} placeholder="City, State" /><datalist id="nightstamp-cities">{CITIES.map(c => <option key={c[0]} value={c[0]} />)}</datalist></label>
            <label>Dedication (optional)<textarea value={dedication} onChange={e => setDedication(e.target.value)} placeholder="For the night we met..." /></label>
            <button onClick={generatePreview} disabled={busy} className="rounded-2xl bg-amber-300 px-5 py-4 font-semibold text-black disabled:opacity-50">{busy ? "Rendering…" : "Preview my night"}</button>
          </div>
          <p className="mt-4 text-sm text-slate-400">{caption}</p>
        </div>
        <div className="rounded-[2rem] border border-amber-200/10 bg-gradient-to-b from-[#0c152a] to-[#02040a] p-6 shadow-2xl">
          {preview ? <img src={preview} alt={caption} className="mx-auto w-full max-w-[760px] rounded-2xl" /> : <div className="flex aspect-square items-center justify-center rounded-2xl border border-white/10 text-center text-slate-500">Your star-map QR preview appears here.</div>}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <button disabled={busy} onClick={() => checkout("digital")} className="rounded-xl bg-white px-4 py-3 text-center font-semibold text-black disabled:opacity-50">Unlock 4K · $9</button>
            <button disabled={busy} onClick={() => checkout("portal")} className="rounded-xl border border-white/15 px-4 py-3 text-center disabled:opacity-50">Portal · $29</button>
            <button disabled={busy} onClick={() => checkout("certified")} className="rounded-xl border border-white/15 px-4 py-3 text-center disabled:opacity-50">Certified · $49</button>
          </div>
          <p className="mt-4 text-center text-xs text-slate-500">Print is a separate $39 unframed / $79 foil add-on after digital unlock.</p>
        </div>
      </section>
    </main>
  );
}
