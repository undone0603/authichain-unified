import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDossier, getCultivar, listFarms, toSlug } from "@/lib/genetics";
import {
  IssuerCommitment,
  PassportFooter,
  SectionRule,
  Tick,
} from "../components";

type Params = { farm: string };

export function generateStaticParams(): Params[] {
  return listFarms().map(farm => ({ farm }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { farm } = await params;
  const d = getDossier(farm);
  if (!d) return { title: "Not found" };
  return {
    title: `${d.farm.name} genetics`,
    description: `Every cultivar ${d.farm.name} holds a certificate for, reconciled against the source certificates of analysis.`,
  };
}

export default async function FarmIndex({
  params,
}: {
  params: Promise<Params>;
}) {
  const { farm } = await params;
  const d = getDossier(farm);
  if (!d) notFound();

  const views = d.cultivars
    .map(c => getCultivar(farm, toSlug(c.id))!)
    .sort((a, b) => (b.peakThcvPct ?? 0) - (a.peakThcvPct ?? 0));

  const flaggedTotal = d.certificates.filter(c => c.derived.mismatch).length;
  const lineageQuestions = d.openQuestions.filter(q =>
    /parentage|lineage|cultivar|codes|belongs/i.test(q.question)
  ).length;

  return (
    <div className="sheet">
      <header className="plate" style={{ padding: "30px 34px" }}>
        <p
          className="mono"
          style={{
            fontSize: ".7rem",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--muted)",
            margin: "0 0 10px",
          }}
        >
          Genetics passport library
        </p>
        <h1
          className="serif"
          style={{
            fontSize: "clamp(2rem,5vw,3rem)",
            lineHeight: 1.05,
            margin: 0,
            fontWeight: 600,
          }}
        >
          {d.farm.name}
        </h1>
        <p
          className="serif"
          style={{
            fontStyle: "italic",
            color: "var(--ink-soft)",
            fontSize: "1.02rem",
            marginTop: 10,
            maxWidth: "60ch",
          }}
        >
          Every cultivar with a certificate on file, with each total recomputed
          from the source panel rather than copied from it.
        </p>
        <div
          style={{
            display: "flex",
            gap: 28,
            flexWrap: "wrap",
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
          }}
        >
          <Stat v={String(d.cultivars.length)} l="Cultivars" />
          <Stat v={String(d.certificates.length)} l="Certificates reconciled" />
          <Stat
            v={`${Math.max(...views.map(v => v.peakThcvPct ?? 0)).toFixed(2)}%`}
            l={`Peak verified THCV — ${views[0].cultivar.id}`}
          />
          <Stat v={String(lineageQuestions)} l="Open lineage questions" />
          <Stat v={String(flaggedTotal)} l="Panels incomplete" />
        </div>
      </header>

      <section>
        <SectionRule>Cultivars · by verified peak THCV</SectionRule>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
            gap: 14,
          }}
        >
          {views.map((v, i) => {
            const flagged = v.certificates.filter(
              c => c.derived.mismatch
            ).length;
            const parent = v.parentEdges[0];
            return (
              <Link
                key={v.cultivar.id}
                href={`/genetics/${farm}/${v.slug}`}
                className="plate"
                style={{
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  textDecoration: "none",
                  color: "inherit",
                  borderColor: i === 0 ? "var(--crimson)" : undefined,
                }}
              >
                <div
                  className="serif"
                  style={{ fontSize: "1.35rem", fontWeight: 600 }}
                >
                  {v.cultivar.id}
                </div>
                {v.cultivar.description && (
                  <div
                    style={{
                      fontSize: ".78rem",
                      color: "var(--muted)",
                      marginTop: -6,
                    }}
                  >
                    {v.cultivar.description}
                  </div>
                )}
                <div style={{ display: "flex", gap: 16, fontSize: ".78rem" }}>
                  <div>
                    <b
                      className="mono"
                      style={{
                        fontSize: ".95rem",
                        display: "block",
                        color: "var(--ink)",
                      }}
                    >
                      {(v.peakThcvPct ?? 0).toFixed(3)}%
                    </b>
                    <span style={{ color: "var(--muted)" }}>Peak THCV</span>
                  </div>
                  <div>
                    <b
                      className="mono"
                      style={{
                        fontSize: ".95rem",
                        display: "block",
                        color: "var(--ink)",
                      }}
                    >
                      {(v.peakRatio ?? 0).toFixed(2)}:1
                    </b>
                    <span style={{ color: "var(--muted)" }}>Best ratio</span>
                  </div>
                  <div>
                    <b
                      className="mono"
                      style={{
                        fontSize: ".95rem",
                        display: "block",
                        color: "var(--ink)",
                      }}
                    >
                      {v.certificates.length}
                    </b>
                    <span style={{ color: "var(--muted)" }}>CoAs</span>
                  </div>
                </div>
                {parent && (
                  <div
                    className={`chip ${parent.provenance === "confirmed_in_writing" ? "chip-teal" : parent.provenance === "none" ? "chip-muted" : "chip-amber"}`}
                    style={{ alignSelf: "flex-start" }}
                  >
                    {parent.provenance === "confirmed_in_writing" && <Tick />}
                    {parent.provenance === "none"
                      ? "Parentage unknown"
                      : parent.provenance === "confirmed_in_writing"
                        ? "Parentage confirmed"
                        : "Parentage inferred"}
                  </div>
                )}
                {flagged > 0 && (
                  <div
                    className="chip chip-amber"
                    style={{ alignSelf: "flex-start" }}
                  >
                    {flagged} panel{flagged > 1 ? "s" : ""} incomplete
                  </div>
                )}
                <div
                  className="mono"
                  style={{
                    marginTop: "auto",
                    fontSize: ".78rem",
                    color: "var(--teal)",
                    borderTop: "1px solid var(--line)",
                    paddingTop: 10,
                  }}
                >
                  View passport →
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <SectionRule>Open questions</SectionRule>
        <p
          style={{
            fontSize: ".92rem",
            color: "var(--muted)",
            maxWidth: "62ch",
            marginBottom: 16,
          }}
        >
          {d.openQuestions.length} items the lab data cannot settle, recorded
          rather than guessed at.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {d.openQuestions.map(q => (
            <div className="note note-amber" key={q.id}>
              <strong style={{ color: "var(--ink)" }}>{q.question}</strong>
              <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                Blocks: {q.blocks}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="note note-crimson">
        <strong style={{ color: "var(--ink)" }}>Scope of this record.</strong>{" "}
        {d.provenanceWarning}
      </div>

      <IssuerCommitment />

      <PassportFooter lab={d.laboratory} issuer={d.farm} updated={d.updated} />
    </div>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span className="mono" style={{ fontSize: "1.3rem", fontWeight: 600 }}>
        {v}
      </span>
      <span style={{ fontSize: ".72rem", color: "var(--muted)" }}>{l}</span>
    </div>
  );
}
