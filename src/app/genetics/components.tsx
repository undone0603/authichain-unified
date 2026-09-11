/**
 * Shared passport furniture. Deliberately small and shared across every issuer:
 * a verification surface earns trust by being recognisable, so the frame is
 * fixed and only its contents vary (decision D5).
 */
import Link from "next/link";
import type { Provenance } from "@/lib/genetics";

export function Tick() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="12" height="12" aria-hidden>
      <path
        d="M4 10.5l3.5 3.5L16 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const PROVENANCE_LABEL: Record<Provenance, string> = {
  confirmed_in_writing: "Confirmed in writing",
  inferred: "Inferred",
  claimed: "Claimed",
  none: "No evidence on file",
};

const PROVENANCE_TONE: Record<Provenance, string> = {
  confirmed_in_writing: "chip-teal",
  inferred: "chip-amber",
  claimed: "chip-amber",
  none: "chip-muted",
};

/**
 * Renders a provenance badge. An inferred edge can never be styled as a
 * confirmed one because the tone is derived from the data, not chosen by
 * whoever writes the page (decision D8).
 */
export function ProvenanceChip({ provenance }: { provenance: Provenance }) {
  return (
    <span className={`chip ${PROVENANCE_TONE[provenance]}`}>
      {provenance === "confirmed_in_writing" && <Tick />}
      {PROVENANCE_LABEL[provenance]}
    </span>
  );
}

export function SectionRule({
  index,
  children,
}: {
  index?: string;
  children: React.ReactNode;
}) {
  return (
    <p className="rule" style={{ marginBottom: 14 }}>
      {index ? `${index} · ` : ""}
      {children}
    </p>
  );
}

/**
 * The commitment that keeps a breeder safe enough to keep sending work.
 * Rendered on every passport, not buried in terms — see decision D1 and the
 * Phylos precedent it comes from.
 */
export function IssuerCommitment() {
  return (
    <div className="note note-teal">
      <strong style={{ color: "var(--ink)" }}>
        StrainChain does not breed.
      </strong>{" "}
      We do not breed, sell, license or take any option on the genetics recorded
      here, and we never will. This record exists so the breeder can prove what
      they held and when. They can export it in full or have it withdrawn at any
      time, without asking us why.
    </div>
  );
}

export function PassportFooter({
  lab,
  issuer,
  updated,
}: {
  lab: {
    name: string;
    address: string;
    license: string;
    accreditation: string;
  };
  issuer: { name: string; address: string; cultivatorDisclosure: string };
  updated: string;
}) {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--line-strong)",
        paddingTop: 28,
        display: "flex",
        flexWrap: "wrap",
        gap: 32,
        justifyContent: "space-between",
        fontSize: ".82rem",
        color: "var(--ink-soft)",
      }}
    >
      <div style={{ flex: "1 1 220px" }}>
        <h4 className="mono" style={footHead}>
          Testing laboratory
        </h4>
        <p style={footP}>{lab.name}</p>
        <p style={footP}>{lab.address}</p>
        <p style={footP}>
          {lab.license} · {lab.accreditation}
        </p>
      </div>
      <div style={{ flex: "1 1 220px" }}>
        <h4 className="mono" style={footHead}>
          Issuer of record
        </h4>
        <p style={footP}>{issuer.name}</p>
        <p style={footP}>{issuer.address}</p>
        <p style={footP}>{issuer.cultivatorDisclosure}</p>
      </div>
      <div style={{ flex: "1 1 220px" }}>
        <h4 className="mono" style={footHead}>
          This record
        </h4>
        <p style={footP}>
          Totals are recomputed from the certificates at page load, never
          transcribed.
        </p>
        <p style={footP}>
          Last reconciled <span className="mono">{updated}</span>.
        </p>
        <p style={{ ...footP, color: "var(--muted)" }}>
          <Link href="/genetics" style={{ color: "var(--teal)" }}>
            How these records are built
          </Link>
        </p>
      </div>
    </footer>
  );
}

const footHead: React.CSSProperties = {
  fontSize: ".68rem",
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--muted)",
  margin: "0 0 8px",
  fontWeight: 500,
};
const footP: React.CSSProperties = { margin: "0 0 4px", lineHeight: 1.5 };
