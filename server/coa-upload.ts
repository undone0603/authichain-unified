import { createHash } from "node:crypto";
import express, { type NextFunction, type Request, type Response, type Router } from "express";

/** Eight mebibytes. A larger upload is HTTP 413. */
export const COA_MAX_BYTES = 8 * 1024 * 1024;

function mediaType(contentType: unknown): string {
  if (typeof contentType !== "string") return "";
  return contentType.split(";")[0].trim().toLowerCase();
}

function asBytes(value: unknown): Uint8Array | null {
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return value;
  return null;
}

/** SHA-256 of the customer's CoA bytes. The buffer is not retained. */
export function hashCoaBytes(bytes: Uint8Array): string {
  if (!asBytes(bytes) || bytes.byteLength < 1) {
    const err = new Error("coa_bytes_required");
    (err as Error & { status: number }).status = 400;
    throw err;
  }
  if (bytes.byteLength > COA_MAX_BYTES) {
    const err = new Error("coa_too_large");
    (err as Error & { status: number }).status = 413;
    throw err;
  }
  return "sha256:" + createHash("sha256").update(bytes).digest("hex");
}

/**
 * Accept only raw application/pdf bytes. A JSON body, or a hash supplied
 * without those bytes, is coa_bytes_required. This does not store the file.
 */
export function acceptCoaUpload(input: {
  contentType: unknown;
  bytes: unknown;
}): { status: number; body: { error: string } | { coaSha256: string } } {
  const bytes = asBytes(input.bytes);
  if (mediaType(input.contentType) !== "application/pdf" || !bytes) {
    return { status: 400, body: { error: "coa_bytes_required" } };
  }
  try {
    const coaSha256 = hashCoaBytes(bytes);
    return { status: 200, body: { coaSha256 } };
  } catch (err) {
    const status = err && typeof err === "object" && "status" in err && err.status === 413 ? 413 : 400;
    return {
      status,
      body: { error: status === 413 ? "coa_too_large" : "coa_bytes_required" },
    };
  }
}

export function coaPdfParser(req: Request, res: Response, next: NextFunction): void {
  if (mediaType(req.headers["content-type"]) !== "application/pdf") {
    res.status(400).json({ error: "coa_bytes_required" });
    return;
  }
  express.raw({ type: "application/pdf", limit: COA_MAX_BYTES })(req, res, (err?: unknown) => {
    if (!err) {
      next();
      return;
    }
    const tooLarge =
      typeof err === "object" &&
      err !== null &&
      (("status" in err && (err as { status?: number }).status === 413) ||
        ("type" in err && (err as { type?: string }).type === "entity.too.large"));
    if (tooLarge) {
      res.status(413).json({ error: "coa_too_large" });
      return;
    }
    next(err);
  });
}

export function coaUpload(req: Request, res: Response): void {
  const result = acceptCoaUpload({
    contentType: req.headers["content-type"],
    bytes: req.body,
  });
  res.status(result.status).json(result.body);
}

/** Mount POST /api/internal/passports/coa. The router secret check still applies. */
export function mountCoaUpload(router: Router): void {
  router.post("/passports/coa", coaPdfParser, coaUpload);
}
