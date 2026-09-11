import type { Metadata } from "next";
import {
  fetchPassport,
  resolverBase,
  type PassportPayload,
  type SealStatus,
} from "@/lib/passport";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Passport ${id}`,
    description: `Verification record for seal ${id}.`,
    robots: { index: false, follow: false },
  };
}

const TONE: Record<SealStatus, { fg: string; bg: string; border: string }> = {
  active: { fg: "#0f7b3f", bg: "#0f7b3f14", border: "#0f7b3f" },
  issued: { fg: "#8a6d00", bg: "#8a6d0014", border: "#8a6d00" },
  clone_suspected: { fg: "#b25e00", bg: "#b25e0014", border: "#b25e00" },
  cloned: { fg: "#a5122a", bg: "#a5122a14", border: "#a5122a" },
  revoked: { fg: "#a5122a", bg: "#a5122a14", border: "#a5122a" },
  not_found: { fg: "#5a5a5a", bg: "#5a5a5a14", border: "#5a5a5a" },
};

export default async function UnitPassport({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const passport = await fetchPassport(id);

  // An unreachable resolver is not the same fact as a seal that does not
  // exist, and must never be rendered as one.
  if (!passport) {
    return (
      <div className="dossier">
        <div className="sheet">
          <div className="note note-amber">
            <strong style={{ color: "var(--ink)" }}>
              Could not reach the verification service.
            </strong>
            <p style={{ margin: "6px 0 0" }}>
              This says nothing about seal <span className="mono">{id}</span> —
              we were unable to ask. Try again shortly. If it persists, the
              resolver at <span className="mono">{resolverBase()}</span> is not
              answering.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tone = TONE[passport.status] ?? TONE.not_found;
  const p = passport.product;

  return (
    <div className="dossier">
      <div className="sheet">
        <header className="plate" style={{ padding: "28px 32px" }}>
          <p className="mono" style={eyebrow}>
            Unit passport · StrainChain
          </p>
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span
              className="chip"
              style={{
                color: tone.fg,
                background: tone.bg,
                borderColor: tone.border,
                fontSize: ".8rem",
                padding: "7px 16px",
              }}
            >
              {passport.label}
            </span>
            {passport.scanRecorded === false &&
              passport.status !== "not_found" && (
                <span
                  className="mono"
                  style={{ fontSize: ".72rem", color: "var(--muted)" }}
                >
                  viewed, not scanned — this page did not change the seal&apos;s
                  state
                </span>
              )}
          </div>

          {p && (
            <h1
              className="serif"
              style={{
                fontSize: "clamp(1.8rem,4vw,2.6rem)",
                lineHeight: 1.05,
                margin: "18px 0 0",
                fontWeight: 600,
              }}
            >
              {p.name ?? "Unnamed product"}
            </h1>
          )}
          {p?.brand && (
            <p
              className="serif"
              style={{
                fontStyle: "italic",
                color: "var(--ink-soft)",
                marginTop: 6,
              }}
            >
              {p.brand}
              {p.issuer && p.issuer !== p.brand
                ? ` · issued by ${p.issuer}`
                : ""}
            </p>
          )}
        </header>

        {/* The honesty block. Shipped on every response by the resolver and
            rendered in full — a green result must not be over-read. */}
        <section>
          <div
            className="grid-cells"
            style={{
              gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            }}
          >
            <div className="cell">
              <p className="mono" style={cellHead}>
                What this proves
              </p>
              <p style={cellBody}>{passport.proves}</p>
            </div>
            <div className="cell">
              <p className="mono" style={cellHead}>
                What it does not
              </p>
              <p style={cellBody}>{passport.doesNotProve}</p>
            </div>
          </div>
        </section>

        <section>
          <p className="rule" style={{ marginBottom: 14 }}>
            Identifier
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="ledger">
              <tbody>
                <Row
                  label="Certificate"
                  value={passport.identifier.certId}
                  mono
                />
                <Row label="GTIN" value={passport.identifier.gtin} mono />
                <Row label="Lot" value={passport.identifier.lot} mono />
                <Row label="Serial" value={passport.identifier.serial} mono />
                <Row
                  label="Digital Link"
                  value={passport.identifier.digitalLink}
                  mono
                />
              </tbody>
            </table>
          </div>
        </section>

        {passport.history && (
          <section>
            <p className="rule" style={{ marginBottom: 14 }}>
              Scan history
            </p>
            <div
              className="grid-cells"
              style={{
                gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
              }}
            >
              <div className="cell">
                <div className="mono" style={statV}>
                  {passport.history.scanCount}
                </div>
                <div style={statL}>Scans recorded</div>
              </div>
              <div className="cell">
                <div className="mono" style={statV}>
                  {passport.history.firstCountry ?? "—"}
                </div>
                <div style={statL}>First seen in</div>
              </div>
              <div className="cell">
                <div className="mono" style={statV}>
                  {passport.history.firstActivatedAt
                    ? new Date(passport.history.firstActivatedAt)
                        .toISOString()
                        .slice(0, 10)
                    : "—"}
                </div>
                <div style={statL}>First activated</div>
              </div>
            </div>
            <p
              style={{
                fontSize: ".8rem",
                color: "var(--muted)",
                marginTop: 12,
              }}
            >
              Location is the scanning network&apos;s country, not GPS. A cloned
              code is detected by its scan pattern, not by inspecting the
              physical item.
            </p>
          </section>
        )}

        {passport.anchor?.txHash && (
          <section>
            <p className="rule" style={{ marginBottom: 14 }}>
              Chain anchor
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="ledger">
                <tbody>
                  <Row label="Network" value={passport.anchor.chain} mono />
                  <Row label="Contract" value={passport.anchor.contract} mono />
                  <Row
                    label="Transaction"
                    value={passport.anchor.txHash}
                    mono
                  />
                </tbody>
              </table>
            </div>
          </section>
        )}

        <footer
          style={{
            borderTop: "1px solid var(--line-strong)",
            paddingTop: 20,
            fontSize: ".78rem",
            color: "var(--muted)",
          }}
        >
          Resolved by <span className="mono">{resolverBase()}</span>. This view
          is read-only and does not register a scan.
        </footer>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <tr>
      <th
        style={{
          width: 160,
          borderBottom: "1px solid var(--line)",
          paddingBottom: 10,
        }}
      >
        {label}
      </th>
      <td
        className={mono ? "mono" : undefined}
        style={{ wordBreak: "break-all" }}
      >
        {value}
      </td>
    </tr>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: ".7rem",
  letterSpacing: ".14em",
  textTransform: "uppercase",
  color: "var(--muted)",
  margin: "0 0 14px",
};
const cellHead: React.CSSProperties = {
  fontSize: ".68rem",
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--muted)",
  margin: "0 0 8px",
};
const cellBody: React.CSSProperties = {
  margin: 0,
  fontSize: ".9rem",
  lineHeight: 1.55,
  color: "var(--ink-soft)",
};
const statV: React.CSSProperties = { fontSize: "1.7rem", fontWeight: 600 };
const statL: React.CSSProperties = {
  fontSize: ".75rem",
  color: "var(--muted)",
  marginTop: 6,
};

export type { PassportPayload };
