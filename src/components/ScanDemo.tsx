"use client";

import { useState } from "react";

export function ScanDemo({
  videoSrc = "/scan-demo.mp4", // replace with R2 public URL or local public/ after HyperFrames render
  poster = "/bottle-qr-poster.jpg",
  verifyUrl = "https://authichain.com/verify?id=polygon-anchor-1",
}: {
  videoSrc?: string;
  poster?: string;
  verifyUrl?: string;
}) {
  const [playing, setPlaying] = useState(false);

  const log = (event: string) => {
    console.log(JSON.stringify({ event, page: "dpp", ts: Date.now() }));
  };

  return (
    <div className="relative max-w-2xl mx-auto rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl">
      {!playing ? (
        <div
          className="relative aspect-video cursor-pointer group"
          onClick={() => {
            setPlaying(true);
            log("video_play");
          }}
        >
          <img src={poster} alt="Scan a signed QR seal" className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition">
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
              <svg className="w-8 h-8 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          <p className="absolute bottom-4 left-4 text-xs font-medium text-white/80">12–15s scan-to-verify</p>
        </div>
      ) : (
        <video
          src={videoSrc}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          controls
          className="w-full aspect-video"
          onPlay={() => log("video_play")}
          onEnded={() => {
            log("video_complete");
            setPlaying(false);
          }}
        />
      )}
      <div className="p-4 text-center space-y-3">
        <p className="text-xs text-zinc-400">
          Published demonstration record (polygon-anchor-1). Not a customer product. Not a physical inspection. Verdict: verified. Physical binding was not inspected.
        </p>
        <a
          href={verifyUrl}
          target="_blank"
          rel="noopener"
          className="inline-block text-sm text-indigo-400 hover:underline"
          onClick={() => log("live_verify_click")}
        >
          Or open the live demonstration record →
        </a>
      </div>
    </div>
  );
}
