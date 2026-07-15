'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const STEPS = [
  { n: '01', title: 'Upload', desc: 'The agency uploads the final document or permit to GovChain.' },
  { n: '02', title: 'Seal', desc: 'A cryptographic fingerprint of the document is written to the ledger.' },
  { n: '03', title: 'Publish', desc: 'A verification code is issued and attached to the public record.' },
  { n: '04', title: 'Verify', desc: 'Anyone can check the code against the sealed fingerprint at any time.' },
];

function RevealOnScroll({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    setTimeout(() => io.observe(el), 50);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-7'
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function GovchainSections() {
  return (
    <>
      {/* How Sealing Works */}
      <section
        id="seal"
        className="border-y border-zinc-900 bg-zinc-950/50 py-28"
      >
        <div className="max-w-[1240px] mx-auto px-12 max-md:px-[22px]">
          <p className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-blue-500 mb-3">
            How Sealing Works
          </p>
          <h2 className="text-center text-3xl font-black mb-12 text-[#eef1f8] tracking-tight">
            From filed document to public record.
          </h2>
          <div className="grid grid-cols-4 max-md:grid-cols-1">
            {STEPS.map((s, i) => (
              <RevealOnScroll
                key={s.n}
                className={[
                  'px-5 py-1',
                  i > 0
                    ? 'border-l border-blue-500/30 max-md:border-l-0 max-md:border-t max-md:border-blue-500/30 max-md:pt-5 max-md:mt-5'
                    : '',
                ].join(' ')}
              >
                <div className="font-mono text-[13px] font-bold text-blue-500 mb-2.5">{s.n}</div>
                <div className="font-bold text-[15px] mb-2 text-[#eef1f8]">{s.title}</div>
                <div className="text-[#a9b4cc] text-[13px] leading-relaxed">{s.desc}</div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Public Verification */}
      <section id="verify" className="py-28">
        <div className="max-w-[1240px] mx-auto px-12 max-md:px-[22px] grid grid-cols-[0.9fr_1.1fr] max-md:grid-cols-1 gap-[70px] items-center">
          <RevealOnScroll className="rounded-md border border-blue-500/20 bg-gradient-to-b from-white/[0.035] to-white/[0.015] p-8">
            <div className="font-bold text-base mb-3.5 text-[#eef1f8]">Public verification</div>
            <div className="text-[#a9b4cc] text-sm leading-relaxed">
              Anyone with a document ID or scan code can confirm the sealed version matches what's on
              file — no login required.
            </div>
          </RevealOnScroll>
          <RevealOnScroll>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-500 mb-3">
              Public Verification
            </p>
            <h2 className="text-[30px] font-black mb-4 text-[#eef1f8] tracking-tight leading-tight">
              Transparency, without the paperwork chase.
            </h2>
            <p className="text-[#a9b4cc] leading-relaxed text-base">
              A resident, journalist, or auditor can check that a public record is exactly what the
              agency filed — down to the timestamp.
            </p>
          </RevealOnScroll>
        </div>
      </section>
    </>
  );
}
