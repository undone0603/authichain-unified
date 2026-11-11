"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Camera QR scanner and seal-ID parser for the public /verify page.
 *
 * Decoding uses jsqr, already a dependency (see src/lib/qron-studio/validate.ts),
 * so this adds no new packages. The camera only starts when the visitor taps
 * the button; nothing is requested on page load.
 */

export type ExtractResult =
  | { ok: true; id: string }
  | { ok: false; reason: "empty" | "invalid" };

/** Seal IDs and object IDs: UUIDs, hex hashes, or slug-like IDs. */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{2,127}$/;

/**
 * Accepts a raw seal ID or a scanned/pasted URL and returns the ID.
 * Recognised URL shapes: `?id=…`, `?seal=…`, `?seal_id=…`, `?object_id=…`,
 * and a trailing path segment after `/verify/`, `/v/` or `/seal/`.
 */
export function validateAndExtract(input: string): ExtractResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "empty" };

  let candidate = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const fromQuery = ["id", "seal", "seal_id", "object_id"]
        .map(k => url.searchParams.get(k))
        .find((v): v is string => Boolean(v && v.trim()));
      if (fromQuery) {
        candidate = fromQuery.trim();
      } else {
        const m = url.pathname.match(/\/(?:verify|v|seal)\/([^/]+)\/?$/);
        if (!m) return { ok: false, reason: "invalid" };
        candidate = decodeURIComponent(m[1]);
      }
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }

  return ID_PATTERN.test(candidate)
    ? { ok: true, id: candidate }
    : { ok: false, reason: "invalid" };
}

type ScannerState = "idle" | "starting" | "scanning" | "denied" | "unsupported" | "invalid";

export function QrScanner({ onResult }: { onResult: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [state, setState] = useState<ScannerState>("idle");

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, {
          inversionAttempts: "attemptBoth",
        });
        if (code?.data) {
          if (validateAndExtract(code.data).ok) {
            stop();
            setState("idle");
            onResult(code.data);
            return;
          }
          setState("invalid");
        }
      }
    }
    frameRef.current = requestAnimationFrame(tick);
  }, [onResult, stop]);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setState("scanning");
      frameRef.current = requestAnimationFrame(tick);
    } catch {
      stop();
      setState("denied");
    }
  }, [stop, tick]);

  const active = state === "starting" || state === "scanning" || state === "invalid";

  return (
    <div className="border border-zinc-800 rounded-xl p-4">
      <video
        ref={videoRef}
        className={active ? "w-full rounded-lg bg-zinc-900" : "hidden"}
        muted
        playsInline
        aria-label="Camera preview for QR scanning"
      />
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      {active ? (
        <div className="flex items-center justify-between mt-3 gap-3">
          <p className="text-xs text-zinc-400" role="status">
            {state === "invalid"
              ? "That QR is not an AuthiChain seal. Try another."
              : "Point the camera at the seal's QR code."}
          </p>
          <button
            type="button"
            onClick={() => {
              stop();
              setState("idle");
            }}
            className="text-xs font-bold text-zinc-300 underline"
          >
            Stop
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={start}
            className="w-full bg-white text-black font-black py-3 rounded-lg text-sm uppercase tracking-wide"
          >
            Scan QR with camera
          </button>
          {state === "denied" && (
            <p className="text-xs text-zinc-400 mt-3" role="status">
              Camera access was blocked. Allow it in your browser, or paste the seal ID below.
            </p>
          )}
          {state === "unsupported" && (
            <p className="text-xs text-zinc-400 mt-3" role="status">
              This browser cannot open the camera. Paste the seal ID below.
            </p>
          )}
        </>
      )}
    </div>
  );
}
