/**
 * Compiles content/docs/public/*.md into HTML.
 * Visual tokens match x402-docs-page.ts (--ac-*). No Tailwind CDN.
 */
import { ESTATE_FONTS_LINK } from "../../_shared/estate-landing";
import {
  assertNoBannedCopy,
  DOCS_PAGES,
  isDocsHub,
  isDocsPage,
  type DocsPageSlug,
} from "./docs-pages";
import indexMd from "../content/docs/public/index.md";
import gs1Md from "../content/docs/public/gs1-digital-link.md";
import verificationMd from "../content/docs/public/verification.md";
import dppMd from "../content/docs/public/dpp-architecture.md";
import examplesMd from "../content/docs/public/examples.md";

const SOURCES: Record<"hub" | DocsPageSlug, string> = {
  hub: indexMd,
  "gs1-digital-link": gs1Md,
  verification: verificationMd,
  "dpp-architecture": dppMd,
  examples: examplesMd,
};

const NAV: { href: string; label: string }[] = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/gs1-digital-link", label: "GS1 Digital Link" },
  { href: "/docs/verification", label: "Verification" },
  { href: "/docs/dpp-architecture", label: "DPP" },
  { href: "/docs/examples", label: "Examples" },
  { href: "/protocol", label: "Protocol" },
  { href: "/x402", label: "x402" },
];

type Frontmatter = {
  title: string;
  meta_title: string;
  meta_description: string;
  canonical: string;
};

function esc(value: string): string {
  return value.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}

function parseFrontmatter(raw: string): { meta: Frontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const meta: Frontmatter = {
    title: "AuthiChain Docs",
    meta_title: "AuthiChain Docs",
    meta_description: "",
    canonical: "https://authichain.com/docs",
  };
  if (!match) return { meta, body: raw };
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key in meta) meta[key as keyof Frontmatter] = value;
  }
  return { meta, body: raw.slice(match[0].length) };
}

function inline(text: string): string {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_all, label: string, href: string) => {
    const safe = href.startsWith("/") || href.startsWith("https://") || href.startsWith("http://");
    if (!safe) return label;
    return `<a href="${esc(href)}">${label}</a>`;
  });
  return out;
}

function renderTable(rows: string[]): string {
  const cells = (line: string) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  const head = cells(rows[0]);
  const body = rows.slice(2).filter((r) => r.trim().startsWith("|"));
  const th = head.map((c) => `<th>${inline(c)}</th>`).join("");
  const tr = body
    .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

function renderMarkdown(body: string): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1;
      html.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i]);
        i += 1;
      }
      html.push(renderTable(rows));
      continue;
    }
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(`<li>${inline(lines[i].slice(2))}</li>`);
        i += 1;
      }
      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\. /, ""))}</li>`);
        i += 1;
      }
      html.push(`<ol>${items.join("")}</ol>`);
      continue;
    }
    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("- ") &&
      !lines[i].startsWith("|") &&
      !lines[i].startsWith("```") &&
      !/^\d+\. /.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    html.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return html.join("\n");
}

/**
 * The source pages deny conformance in the sentence "not a GS1 Conformant
 * Resolver" and name AC-DEMO-001 only to say it is not a live scan. Those
 * phrases are allowed. An affirmative claim is not.
 */
export function residualBannedCopy(html: string): string[] {
  const text = html.replace(/<[^>]+>/g, "");
  const allowed = text
    .replaceAll("not a GS1 Conformant Resolver", "")
    .replaceAll("Is AuthiChain a GS1 Conformant Resolver?", "")
    .replaceAll(
      "Conformance as a GS1 Conformant Resolver is a third thing",
      "",
    )
    .replaceAll(
      "AC-DEMO-001 is a repository fixture. It is not a live public scan target while the resolver host is down.",
      "",
    );
  return assertNoBannedCopy(allowed);
}

const CSS = `:root {
  --ac-bg: #ffffff;
  --ac-bg-muted: #f8fafc;
  --ac-ink: #0f172a;
  --ac-muted: #475569;
  --ac-faint: #64748b;
  --ac-border: #e2e8f0;
  --ac-accent: #4F46E5;
  --ac-accent-ink: #ffffff;
  --ac-radius: 10px;
  --ac-shadow: 0 1px 2px rgba(79,70,229,.06), 0 16px 40px rgba(79,70,229,.10);
  --ac-display: "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif;
  --ac-body: "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif;
  --ac-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --ac-measure: 42rem;
  --ac-page: 68rem;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--ac-bg);color:var(--ac-ink);font-family:var(--ac-body);font-size:16px;line-height:1.65}
a{color:var(--ac-accent);text-underline-offset:2px}
a:focus-visible{outline:2px solid var(--ac-accent);outline-offset:3px}
.skip{position:absolute;left:12px;top:-48px;background:var(--ac-ink);color:#fff;padding:8px 12px;border-radius:6px}
.skip:focus{top:12px}
.wrap{width:min(var(--ac-page),calc(100% - 2rem));margin:0 auto}
.nav{position:sticky;top:0;background:rgba(255,255,255,.94);border-bottom:1px solid var(--ac-border)}
.nav-inner{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.85rem 0;flex-wrap:wrap}
.brand{font-weight:600;color:var(--ac-ink);text-decoration:none}
.brand span{color:var(--ac-accent)}
.nav-links{display:flex;gap:.9rem;list-style:none;flex-wrap:wrap;font-size:.9rem}
.nav-links a{color:var(--ac-muted);text-decoration:none}
.nav-links a[aria-current="page"]{color:var(--ac-ink);font-weight:600}
main{padding:2.5rem 0 4rem}
article{max-width:var(--ac-measure)}
h1{font-family:var(--ac-display);font-size:clamp(1.8rem,4vw,2.6rem);line-height:1.15;letter-spacing:-.03em;margin:0 0 1rem}
h2{font-family:var(--ac-display);font-size:1.35rem;margin:2rem 0 .7rem;letter-spacing:-.02em}
h3{font-size:1.05rem;margin:1.4rem 0 .4rem}
p{margin:0 0 .9rem;color:var(--ac-muted)}
ul,ol{margin:0 0 1rem 1.2rem;color:var(--ac-muted)}
li{margin:.3rem 0}
code{font-family:var(--ac-mono);font-size:.86em;background:var(--ac-bg-muted);border:1px solid var(--ac-border);border-radius:6px;padding:.05rem .35rem}
pre{background:#0b1220;color:#e2e8f0;border-radius:var(--ac-radius);padding:1rem 1.1rem;overflow-x:auto;margin:0 0 1.2rem}
pre code{background:transparent;border:0;color:inherit;padding:0}
.table-wrap{overflow-x:auto;margin:0 0 1.2rem}
table{border-collapse:collapse;width:100%;font-size:.92rem}
th,td{border:1px solid var(--ac-border);padding:.5rem .65rem;text-align:left;vertical-align:top}
th{background:var(--ac-bg-muted);color:var(--ac-ink)}
td{color:var(--ac-muted)}
footer.site{border-top:1px solid var(--ac-border);padding:1.4rem 0 2rem;color:var(--ac-faint);font-size:.85rem}
`;

export function renderDocsPage(pathname: string): string {
  const slug = isDocsHub(pathname) ? "hub" : isDocsPage(pathname);
  if (!slug) {
    return "<!doctype html><title>Not found</title><p>Unknown docs page.</p>";
  }
  const { meta, body } = parseFrontmatter(SOURCES[slug]);
  const article = renderMarkdown(body);
  const current = slug === "hub" ? "/docs" : `/docs/${slug}`;
  const nav = NAV.map(
    (item) =>
      `<li><a href="${item.href}"${item.href === current ? ' aria-current="page"' : ""}>${esc(item.label)}</a></li>`,
  ).join("");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.meta_title)}</title>
<meta name="description" content="${esc(meta.meta_description)}">
<link rel="canonical" href="${esc(meta.canonical)}">
${ESTATE_FONTS_LINK}
<style>${CSS}</style>
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header class="nav"><div class="wrap nav-inner">
<a class="brand" href="/">Authi<span>Chain</span></a>
<nav aria-label="Documentation"><ul class="nav-links">${nav}</ul></nav>
</div></header>
<main class="wrap" id="content"><article>${article}</article></main>
<footer class="site"><div class="wrap">AuthiChain documentation. A signature is not proof a physical item is genuine.</div></footer>
</body></html>`;
  const banned = residualBannedCopy(html);
  if (banned.length) {
    throw new Error(`docs page ${pathname} contains banned copy: ${banned.join(", ")}`);
  }
  void DOCS_PAGES;
  return html;
}
