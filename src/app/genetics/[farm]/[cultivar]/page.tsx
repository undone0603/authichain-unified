import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DECARB,
  getCultivar,
  getDossier,
  listFarms,
  toSlug,
  type DerivedCertificate,
} from "@/lib/genetics";
import {
  IssuerCommitment,
  PassportFooter,
  ProvenanceChip,
  SectionRule,
  Tick,
} from "../../components";

type Params = { farm: string; cultivar: string };

export function generateStaticParams(): Params[] {
  return listFarms().flatMap(farm => {
    const d = getDossier(farm);
    return d ? d.cultivars.map(c => ({ farm, cultivar: toSlug(c.id) })) : [];
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { farm, cultivar } = await params;
  const view = getCultivar(farm, cultivar);
  const dossier = getDossier(farm);
  if (!view || !dossier) return { title: "Not found" };
  return {
    title: view.cultivar.id,
    description: `Genetics passport for ${view.cultivar.id} — ${view.certificates.length} certificate(s) of analysis reconciled for ${dossier.farm.name}, with every total recomputed from the source panel.`,
  };
}

function pct(n: number | null | undefined, dp = 3): string {
  return n == null ? "—" : `${n.toFixed(dp)}%`;
}

/** The verification line for one certificate, derived rather than asserted. */
function VerificationCell({ cert }: { cert: DerivedCertificate }) {
  const { derived } = cert;

  if (derived.mismatch) {
    const m = derived.mismatch;
    return (
      <span
        className="chip chip-amber"
        title={`Published ${m.published}% vs derived ${m.derived}%`}
      >
        Panel incomplete
      </span>
    );
  }
  if (derived.totalThcvPct == null) {
    return (
      <span
        className="chip chip-muted"
        title="No compound panel captured for this certificate"
      >
        Totals only
      </span>
    );
  }
  return (
    <span className="chip chip-teal">
      <Tick />
      Recomputed
    </span>
  );
}

export default async function CultivarDossier({
  params,
}: {
  params: Promise<Params>;
}) {
  const { farm, cultivar } = await params;
  const view = getCultivar(farm, cultivar);
  const dossier = getDossier(farm);
  if (!view || !dossier) notFound();

  const { certificates, cultivar: c } = view;
  const flagged = certificates.filter(x => x.derived.mismatch);
  const terpCert = certificates.find(x => x.terpenes_pct);

  return (
    <div className="sheet">
      <header
        className="plate"
        style={{
          padding: "28px 32px",
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div>
          <p className="mono" style={eyebrow}>
            Genetics passport ·{" "}
            <Link href={`/genetics/${farm}`} style={{ color: "inherit" }}>
              {dossier.farm.name}
            </Link>
          </p>
          <h1
            className="serif"
            style={{
              fontSize: "clamp(2.6rem,6vw,4.2rem)",
              lineHeight: 0.95,
              margin: 0,
              fontWeight: 600,
            }}
          >
            {c.id}
          </h1>
          {c.description && (
            <p
              className="serif"
              style={{
                fontStyle: "italic",
                color: "var(--ink-soft)",
                fontSize: "1.05rem",
                marginTop: 8,
              }}
            >
              {c.description}
            </p>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 9,
            alignItems: "flex-end",
            textAlign: "right",
            minWidth: 200,
          }}
        >
          <span
            className={`chip ${flagged.length ? "chip-amber" : "chip-teal"}`}
          >
            {flagged.length === 0 && <Tick />}
            {flagged.length === 0
              ? "All totals recomputed"
              : `${flagged.length} panel${flagged.length > 1 ? "s" : ""} incomplete`}
          </span>
          <span style={meta}>
            {certificates.length} certificate
            {certificates.length === 1 ? "" : "s"} on file
          </span>
          <span style={meta}>
            Rank {view.thcvRank} of {view.totalCultivars} on peak THCV
          </span>
        </div>
      </header>

      {/* ---- headline figures, all derived ---- */}
      <section>
        <div
          className="grid-cells"
          style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}
        >
          <div className="cell">
            <div className="mono" style={{ ...statV, color: "var(--crimson)" }}>
              {pct(view.peakThcvPct)}
            </div>
            <div style={statL}>Peak total THCV</div>
          </div>
          <div className="cell">
            <div className="mono" style={statV}>
              {view.peakRatio == null ? "—" : `${view.peakRatio.toFixed(2)}:1`}
            </div>
            <div style={statL}>Best THCV : THC ratio</div>
          </div>
          <div className="cell">
            <div className="mono" style={statV}>
              {certificates.length}
            </div>
            <div style={statL}>Certificates reconciled</div>
          </div>
          <div className="cell">
            <div className="mono" style={statV}>
              {view.openQuestions.length}
            </div>
            <div style={statL}>Open questions</div>
          </div>
        </div>
        <p style={{ fontSize: ".82rem", color: "var(--muted)", marginTop: 12 }}>
          Every figure above is recomputed from the raw mg/g on the certificates
          at page load, using the standard decarboxylation factor of {DECARB}.
          Nothing here is a transcribed headline.
        </p>
      </section>

      {/* ---- the ledger ---- */}
      <section>
        <SectionRule index="01">Certificate ledger</SectionRule>
        <h2 className="serif" style={h2}>
          Chemistry over time
        </h2>
        <p style={sectionNote}>
          Newest first. A passport is a living record, not a snapshot — each new
          certificate appends here and the headline figures move with it.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="ledger">
            <thead>
              <tr>
                <th>Sample</th>
                <th>CoA</th>
                <th>Collected</th>
                <th className="n">Total THCV</th>
                <th className="n">Total THC</th>
                <th className="n">Ratio</th>
                <th>Verification</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map(cert => (
                <tr key={cert.coa_id}>
                  <td>
                    {cert.sample_name_on_coa}
                    {cert.amendment_of && (
                      <span
                        style={{
                          color: "var(--muted)",
                          fontSize: ".78rem",
                          display: "block",
                        }}
                      >
                        amends {cert.amendment_of}
                      </span>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: ".8rem" }}>
                    {cert.coa_id}
                  </td>
                  <td className="mono" style={{ fontSize: ".8rem" }}>
                    {cert.collected}
                  </td>
                  <td className="mono n">
                    {pct(cert.derived.totalThcvPct ?? cert.totals_pct.thcv)}
                  </td>
                  <td className="mono n">
                    {pct(cert.derived.totalThcPct ?? cert.totals_pct.thc)}
                  </td>
                  <td className="mono n">
                    {(cert.derived.ratio ?? cert.ratio_thcv_thc).toFixed(2)}:1
                  </td>
                  <td>
                    <VerificationCell cert={cert} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {flagged.map(cert => (
          <div
            className="note note-amber"
            key={cert.coa_id}
            style={{ marginTop: 16 }}
          >
            <strong style={{ color: "var(--ink)" }}>
              {cert.sample_name_on_coa}: the panel does not account for the
              reported total.
            </strong>{" "}
            The certificate reports {pct(cert.derived.mismatch!.published, 2)}{" "}
            total {cert.derived.mismatch!.field.toUpperCase()}, but the
            compounds we hold sum to {pct(cert.derived.mismatch!.derived)}
            {cert.derived.mismatch!.impliedMissingPct != null && (
              <>
                {" "}
                — roughly {pct(cert.derived.mismatch!.impliedMissingPct)} is
                unaccounted for
              </>
            )}
            . We show the discrepancy rather than picking a side. Pending
            recovery of the full panel from{" "}
            <span className="mono">{cert.coa_id}</span>.
          </div>
        ))}
      </section>

      {/* ---- terpenes, only where a panel exists ---- */}
      {terpCert?.terpenes_pct && (
        <section>
          <SectionRule index="02">Terpene profile</SectionRule>
          <h2 className="serif" style={h2}>
            {terpCert.terpenes_tested_count ??
              Object.keys(terpCert.terpenes_pct).length}{" "}
            terpenoids tested · {pct(terpCert.terpenes_total_pct, 3)} total
          </h2>
          <p style={sectionNote}>
            From <span className="mono">{terpCert.coa_id}</span>, collected{" "}
            {terpCert.collected}.
          </p>
          <TerpeneBars terpenes={terpCert.terpenes_pct} />
        </section>
      )}

      {/* ---- lineage ---- */}
      <section>
        <SectionRule index={terpCert?.terpenes_pct ? "03" : "02"}>
          Lineage
        </SectionRule>
        <h2 className="serif" style={h2}>
          Parentage &amp; descendants
        </h2>
        <p style={sectionNote}>
          Each relation carries how it is known. An inferred edge is never shown
          as a confirmed one.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...view.parentEdges, ...view.childEdges].length === 0 && (
            <div className="note">
              No lineage relations recorded for this cultivar.
            </div>
          )}
          {view.parentEdges.map((e, i) => (
            <LineageRow
              key={`p${i}`}
              farm={farm}
              label="Parentage"
              edge={e}
              subject={c.id}
            />
          ))}
          {view.childEdges.map((e, i) => (
            <LineageRow
              key={`c${i}`}
              farm={farm}
              label="Descendant"
              edge={e}
              subject={c.id}
            />
          ))}
        </div>
      </section>

      {/* ---- awards, marked for what they are ---- */}
      {c.awards && c.awards.length > 0 && (
        <section>
          <SectionRule>Recognition</SectionRule>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {c.awards.map(a => (
              <div className="note" key={a.name}>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ color: "var(--ink)" }}>
                    {a.name} ({a.year})
                  </strong>
                  <ProvenanceChip provenance={a.provenance} />
                </div>
                <p style={{ margin: "6px 0 0" }}>{a.evidence}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- what we do not know ---- */}
      {view.openQuestions.length > 0 && (
        <section>
          <SectionRule>Open questions</SectionRule>
          <h2 className="serif" style={h2}>
            What the lab data cannot settle
          </h2>
          <p style={sectionNote}>
            Recorded rather than guessed. Each names what it blocks.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {view.openQuestions.map(q => (
              <div className="note note-amber" key={q.id}>
                <strong style={{ color: "var(--ink)" }}>{q.question}</strong>
                <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                  Blocks: {q.blocks}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <IssuerCommitment />

      <PassportFooter
        lab={dossier.laboratory}
        issuer={dossier.farm}
        updated={dossier.updated}
      />
    </div>
  );
}

function LineageRow({
  farm,
  label,
  edge,
  subject,
}: {
  farm: string;
  label: string;
  edge: {
    parent?: string | null;
    parents?: string[];
    child: string;
    relation: string;
    provenance: import("@/lib/genetics").Provenance;
    evidence: string;
  };
  subject: string;
}) {
  const parents = edge.parents ?? (edge.parent ? [edge.parent] : []);
  const others = label === "Parentage" ? parents : [edge.child];
  return (
    <div className="note">
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: ".7rem",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          {label}
        </span>
        <strong style={{ color: "var(--ink)" }}>
          {others.length === 0
            ? "Unknown"
            : others.map((o, i) => (
                <span key={o}>
                  {i > 0 && " × "}
                  <Link
                    href={`/genetics/${farm}/${toSlug(o)}`}
                    style={{ color: "var(--teal)" }}
                  >
                    {o}
                  </Link>
                </span>
              ))}
        </strong>
        <span
          className="mono"
          style={{ fontSize: ".72rem", color: "var(--muted)" }}
        >
          {edge.relation.replace(/_/g, " ")} {subject === edge.child ? "" : ""}
        </span>
        <ProvenanceChip provenance={edge.provenance} />
      </div>
      <p style={{ margin: "8px 0 0" }}>{edge.evidence}</p>
    </div>
  );
}

function TerpeneBars({ terpenes }: { terpenes: Record<string, number> }) {
  const rows = Object.entries(terpenes).sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] ?? 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {rows.map(([name, value], i) => (
        <div
          key={name}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(110px,150px) 1fr 68px",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: ".82rem",
              color: i === 0 ? "var(--ink)" : "var(--ink-soft)",
              fontWeight: i === 0 ? 600 : 400,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name.replace(/_/g, "-")}
          </span>
          <div
            style={{
              height: 9,
              background: "var(--line)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(value / max) * 100}%`,
                background: i === 0 ? "var(--crimson)" : "var(--line-strong)",
                borderRadius: 2,
              }}
            />
          </div>
          <span
            className="mono"
            style={{
              fontSize: ".78rem",
              textAlign: "right",
              color: "var(--ink-soft)",
            }}
          >
            {value.toFixed(3)}%
          </span>
        </div>
      ))}
    </div>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: ".7rem",
  letterSpacing: ".14em",
  textTransform: "uppercase",
  color: "var(--muted)",
  margin: "0 0 10px",
};
const meta: React.CSSProperties = { fontSize: ".82rem", color: "var(--muted)" };
const statV: React.CSSProperties = { fontSize: "1.9rem", fontWeight: 600 };
const statL: React.CSSProperties = {
  fontSize: ".78rem",
  color: "var(--muted)",
  marginTop: 6,
};
const h2: React.CSSProperties = {
  fontSize: "1.5rem",
  margin: "0 0 4px",
  fontWeight: 600,
};
const sectionNote: React.CSSProperties = {
  fontSize: ".92rem",
  color: "var(--muted)",
  maxWidth: "62ch",
  marginBottom: 20,
};
