/**
 * THCV across every certificate on file, over time.
 *
 * Form: a dot plot, not a line chart — the points are different cultivars, so
 * connecting them would assert a continuity the data does not have. Time is on
 * the x-axis, which is why the marks are NOT coloured by generation: that would
 * encode the same fact twice. Two series only (the flagship against the rest of
 * the family), which is also what the palette validator permits — five
 * generation colours hard-failed the normal-vision floor under --pairs all.
 *
 * Palette: reference categorical slots 1 and 2, validated in both modes against
 * this surface (#f8f9f3 / #1a2219) with --pairs all. All six checks pass.
 *
 * The honest shape of this data is a high, stable band from 6.2% to 11.6%, not
 * a rising line. The two peaks are VT-26 and its LT-35 daughter. Anything that
 * drew a trend through it would be reintroducing the overclaim that the first
 * prototype pass made.
 */
import type { DerivedCertificate } from "@/lib/genetics";

type Point = {
  coaId: string;
  cultivar: string;
  sample: string;
  date: string;
  thcv: number;
  ratio: number;
  t: number;
  isFlagship: boolean;
};

/** Cultivar ids are database keys; these are what a reader should see. */
function label(id: string): string {
  return id.replace(/x/g, " \u00d7 ");
}

const W = 720;
const H = 300;
const PAD = { top: 24, right: 74, bottom: 42, left: 46 };

export function ThcvTimeline({
  certificates,
  flagship = "VT-26",
}: {
  certificates: DerivedCertificate[];
  flagship?: string;
}) {
  const pts: Point[] = certificates
    .map(c => {
      const thcv = c.derived.totalThcvPct ?? c.totals_pct.thcv;
      const ratio = c.derived.ratio ?? c.ratio_thcv_thc;
      if (thcv == null) return null;
      return {
        coaId: c.coa_id,
        cultivar: c.cultivar,
        sample: c.sample_name_on_coa,
        date: c.collected,
        thcv,
        ratio: ratio ?? 0,
        t: Date.parse(c.collected),
        isFlagship: c.cultivar === flagship,
      };
    })
    .filter((p): p is Point => p !== null)
    .sort((a, b) => a.t - b.t);

  if (pts.length === 0) return null;

  const tMin = Math.min(...pts.map(p => p.t));
  const tMax = Math.max(...pts.map(p => p.t));
  const yMax = Math.ceil(Math.max(...pts.map(p => p.thcv)) + 1);
  const yMin = Math.floor(Math.min(...pts.map(p => p.thcv)) - 1);

  const x = (t: number) =>
    PAD.left + ((t - tMin) / (tMax - tMin || 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    H -
    PAD.bottom -
    ((v - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom);

  const ticks: number[] = [];
  for (let v = yMin; v <= yMax; v += 2) ticks.push(v);

  const years = Array.from(new Set(pts.map(p => p.date.slice(0, 4))));

  return (
    // viz-root sits on the figure, not the svg: the legend swatches live in the
    // figcaption and need the same --viz-* scope. Scoped to the svg alone they
    // resolved to nothing and rendered transparent.
    <figure className="viz-root" style={{ margin: 0 }}>
      <div style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`Total THCV for each of ${pts.length} certificates, from ${pts[0].date} to ${pts[pts.length - 1].date}. Values range from ${Math.min(...pts.map(p => p.thcv)).toFixed(2)} to ${Math.max(...pts.map(p => p.thcv)).toFixed(2)} percent. The full figures are in the certificate ledger below.`}
          style={{ display: "block", overflow: "visible" }}
        >
          {/* recessive grid */}
          {ticks.map(v => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--line)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={y(v) + 4}
                textAnchor="end"
                className="mono"
                fontSize="10"
                fill="var(--muted)"
              >
                {v}%
              </text>
            </g>
          ))}

          {/* year ticks, from the data rather than a fixed axis */}
          {years.map(yr => {
            const first = pts.find(p => p.date.startsWith(yr))!;
            return (
              <text
                key={yr}
                x={x(first.t)}
                y={H - PAD.bottom + 18}
                textAnchor="middle"
                className="mono"
                fontSize="10"
                fill="var(--muted)"
              >
                {yr}
              </text>
            );
          })}

          {pts.map(p => {
            const cx = x(p.t);
            const cy = y(p.thcv);
            const c = p.isFlagship ? "var(--viz-2)" : "var(--viz-1)";
            return (
              <g key={p.coaId} className="pt">
                {/* 2px surface ring so overlapping marks stay separable */}
                <circle cx={cx} cy={cy} r="7" fill="var(--paper-raised)" />
                <circle cx={cx} cy={cy} r="5" fill={c} />
                {/* hit target larger than the mark */}
                <circle cx={cx} cy={cy} r="16" fill="transparent" />
                <g
                  className="tip"
                  pointerEvents="none"
                  transform={`translate(${cx}, ${cy})`}
                >
                  <rect
                    x={cx > W - 190 ? -186 : 10}
                    y={-46}
                    width="176"
                    height="40"
                    rx="3"
                    fill="var(--paper-raised)"
                    stroke="var(--line-strong)"
                  />
                  <text
                    x={cx > W - 190 ? -176 : 20}
                    y={-30}
                    fontSize="11"
                    fill="var(--ink)"
                    fontWeight="600"
                  >
                    {p.cultivar} · {p.sample}
                  </text>
                  <text
                    x={cx > W - 190 ? -176 : 20}
                    y={-15}
                    fontSize="10"
                    className="mono"
                    fill="var(--ink-soft)"
                  >
                    {p.thcv.toFixed(3)}% · {p.ratio.toFixed(2)}:1 · {p.date}
                  </text>
                </g>
              </g>
            );
          })}

          {/* direct labels: one per cultivar, on its highest certificate */}
          {Array.from(new Set(pts.map(p => p.cultivar))).map(name => {
            const best = pts
              .filter(p => p.cultivar === name)
              .sort((a, b) => b.thcv - a.thcv)[0];
            const lx = x(best.t);
            const nearRight = lx > W - PAD.right - 40;
            const nearLeft = lx < PAD.left + 40;
            return (
              <text
                key={name}
                x={nearRight || nearLeft ? lx + 12 : lx}
                y={y(best.thcv) - (nearRight || nearLeft ? 3 : 12)}
                textAnchor={nearRight || nearLeft ? "start" : "middle"}
                fontSize="10"
                fontWeight="600"
                fill="var(--ink-soft)"
              >
                {label(name)}
              </text>
            );
          })}
        </svg>
      </div>

      <figcaption
        style={{ marginTop: 14, fontSize: ".82rem", color: "var(--muted)" }}
      >
        <span
          style={{
            display: "inline-flex",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 10,
                flex: "none",
                background: "var(--viz-2)",
              }}
            />
            {flagship}
          </span>
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 10,
                flex: "none",
                background: "var(--viz-1)",
              }}
            />
            Rest of the family
          </span>
        </span>
        <br />
        Every point is one certificate, positioned by collection date and
        recomputed total THCV. The band is high and stable rather than rising —{" "}
        {flagship} and its LT&#8209;35 daughter are the two peaks. Exact figures
        are in the ledger below.
      </figcaption>
    </figure>
  );
}
