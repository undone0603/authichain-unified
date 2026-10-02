"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Cloud,
  Code2,
  GitBranch,
  Layers3,
  LockKeyhole,
  Radio,
  RefreshCw,
  Rss,
  Share2,
  ShoppingBag,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import {
  buildStories,
  displaySource,
  type SiFeedEvent,
} from "../../lib/si-storymode";
import "./si-feed.css";

type FeedResponse = {
  events: SiFeedEvent[];
  generated_at: string;
  refresh_after_seconds: number;
  sources: string[];
  is_owner?: boolean;
};

const connectors = [
  { name: "GitHub", icon: GitBranch, state: "Next up", tone: "violet" },
  { name: "Cloudflare", icon: Cloud, state: "Next up", tone: "orange" },
  { name: "Supabase", icon: Layers3, state: "Next up", tone: "green" },
  { name: "CLI + CI", icon: Code2, state: "Next up", tone: "blue" },
];

const mcpSpotlights = [
  {
    topic: "commerce",
    name: "Stripe Agent Toolkit",
    detail: "Payment and checkout capabilities for agents.",
    href: "https://docs.stripe.com/agents",
  },
  {
    topic: "trust",
    name: "GitHub MCP Server",
    detail: "Repository context and developer workflows.",
    href: "https://github.com/github/github-mcp-server",
  },
  {
    topic: "developer",
    name: "Supabase MCP Server",
    detail: "Database and project capabilities from Supabase.",
    href: "https://github.com/supabase-community/supabase-mcp",
  },
];

function relativeTime(value: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000)
  );
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export default function SiFeedClient() {
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [source, setSource] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [entity, setEntity] = useState("");
  const [viewMode, setViewMode] = useState<"signals" | "story">("signals");
  const [copied, setCopied] = useState(false);
  const [consentBusy, setConsentBusy] = useState<string | null>(null);
  const [consentMessage, setConsentMessage] = useState<string | null>(null);
  const [consentedSources, setConsentedSources] = useState<string[]>([]);
  const [spotlightTopic, setSpotlightTopic] = useState("");
  const [liveConnected, setLiveConnected] = useState(false);

  const loadFeed = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch("/api/si/feed", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        setError(
          "Sign in with the owner account to view private event details."
        );
        setFeed(null);
        return;
      }
      if (!response.ok) throw new Error("The feed is temporarily unavailable.");
      const result = (await response.json()) as FeedResponse;
      setFeed(result);
      if (result.is_owner) {
        const consentResponse = await fetch("/api/si/consents", {
          cache: "no-store",
        });
        if (consentResponse.ok) {
          const consentBody = (await consentResponse.json()) as {
            consents: Array<{ source: string; share_public: boolean }>;
          };
          setConsentedSources(
            consentBody.consents
              .filter(consent => consent.share_public)
              .map(consent => consent.source)
          );
        }
      }
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The feed is temporarily unavailable."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const updateConsent = async (sourceName: string, sharePublic: boolean) => {
    setConsentBusy(sourceName);
    setConsentMessage(null);
    try {
      const response = await fetch("/api/si/consents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourceName, share_public: sharePublic }),
      });
      if (!response.ok) throw new Error();
      setConsentedSources(current =>
        sharePublic
          ? [...new Set([...current, sourceName])]
          : current.filter(item => item !== sourceName)
      );
      setConsentMessage(
        sharePublic
          ? `${sourceName} feed sharing enabled.`
          : `${sourceName} feed sharing revoked.`
      );
    } catch {
      setConsentMessage("Permission could not be updated. Please try again.");
    } finally {
      setConsentBusy(null);
    }
  };

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadFeed(), 0);
    const timer = window.setInterval(() => void loadFeed(true), 30_000);
    const stream = new EventSource("/api/si/events/stream");
    const onSignal = (raw: Event) => {
      try {
        const event = JSON.parse((raw as MessageEvent<string>).data) as SiFeedEvent;
        setFeed(current => {
          if (!current || current.events.some(existing => existing.id === event.id)) {
            return current;
          }
          return { ...current, events: [event, ...current.events].slice(0, 100) };
        });
      } catch {
        void loadFeed(true);
      }
    };
    for (const eventName of ["github", "ci", "deployment", "agentz"]) {
      stream.addEventListener(eventName, onSignal);
    }
    stream.onopen = () => setLiveConnected(true);
    stream.onerror = () => setLiveConnected(false);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      stream.close();
    };
  }, [loadFeed]);

  const events = useMemo(() => {
    const query = entity.trim().toLowerCase();
    return (feed?.events ?? []).filter(event => {
      const matchesSource = source === "all" || event.source === source;
      const matchesSeverity = severity === "all" || event.severity === severity;
      const matchesEntity =
        !query || event.entity.toLowerCase().includes(query);
      return matchesSource && matchesSeverity && matchesEntity;
    });
  }, [entity, feed, severity, source]);

  const stories = useMemo(() => buildStories(events), [events]);
  const selectedSpotlights = useMemo(
    () => mcpSpotlights.filter(spotlight => spotlight.topic === spotlightTopic),
    [spotlightTopic]
  );

  const shareFeed = async () => {
    const url = window.location.href;
    const shareData = {
      title: "AuthiChain SI Feed",
      text: "Every signal. One stream. Built by @undone0603.",
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      }
    } catch {
      // A dismissed native share sheet is not an error state.
    }
  };

  const eventCount = feed?.events.length ?? 0;

  return (
    <main className="si-page">
      <div className="si-wrap">
        <nav className="si-topbar" aria-label="SI Feed">
          <Link className="si-wordmark" href="/" aria-label="AuthiChain home">
            <span className="si-mark">
              <Activity size={17} strokeWidth={2.6} />
            </span>
            <span>
              AUTHICHAIN<span className="si-wordmark-dot">.</span>
            </span>
          </Link>
          <div className="si-topbar-right">
            <span className="si-edition">
              <span /> SIGNAL INTELLIGENCE
            </span>
            <button
              type="button"
              className="si-share"
              onClick={() => void shareFeed()}
            >
              {copied ? <Check size={15} /> : <Share2 size={15} />}
              <span>{copied ? "Link copied" : "Share the feed"}</span>
            </button>
          </div>
        </nav>

        <section className="si-hero">
          <div className="si-hero-copy">
            <div className="si-eyebrow">
              <span className="si-eyebrow-line" /> THE COMPANY, IN MOTION
            </div>
            <h1>
              Every signal.
              <br />
              <span>One stream.</span>
            </h1>
            <p className="si-deck">
              The live pulse of AuthiChain—workflows, systems, and the small
              moments that move the whole network forward.
            </p>
            <div className="si-byline">
              <div className="si-avatar" aria-hidden="true">
                U
              </div>
              <div>
                <span className="si-byline-label">A living system by</span>
                <a
                  href="https://github.com/undone0603"
                  target="_blank"
                  rel="noreferrer"
                >
                  @undone0603 <ArrowRight size={13} />
                </a>
              </div>
              <span className="si-byline-divider" />
              <span className="si-brand-note">
                Built in the open.
                <br />
                Rooted in trust.
              </span>
            </div>
          </div>

          <div
            className="si-hero-art"
            aria-label="Illustration of connected systems flowing into one signal stream"
          >
            <div className="si-orbit si-orbit-one" />
            <div className="si-orbit si-orbit-two" />
            <div className="si-orbit si-orbit-three" />
            <div className="si-orbit-core">
              <Activity size={30} />
            </div>
            <span className="si-orbit-label si-orbit-label-one">INPUT</span>
            <span className="si-orbit-label si-orbit-label-two">TRUST</span>
            <span className="si-orbit-label si-orbit-label-three">SIGNAL</span>
            <span className="si-spark si-spark-one" />
            <span className="si-spark si-spark-two" />
            <span className="si-spark si-spark-three" />
          </div>

          <div className="si-hero-foot">
            <span>
              OBSERVE <ArrowDownRight size={14} /> NORMALIZE{" "}
              <ArrowDownRight size={14} /> ACT
            </span>
            <span>
              AN AUTHICHAIN ORIGINAL&nbsp; · &nbsp;NOISE OUT. SIGNAL IN.
            </span>
          </div>
        </section>

        <section className="si-main-grid" aria-label="Live SI Feed">
          <div className="si-feed-column">
            <div className="si-section-heading">
              <div>
                <div className="si-label">THE LIVE FEED</div>
                <h2>What&apos;s moving</h2>
              </div>
              <div className={`si-stream-state ${error ? "is-idle" : ""}`}>
                <span className="si-stream-dot" />
                {error
                  ? "FEED PAUSED"
                  : liveConnected
                    ? "LIVE SIGNALS"
                    : "AUTO-REFRESH · 30S"}
              </div>
            </div>

            <div className="si-filterbar">
              <label className="si-filter">
                <span className="sr-only">Filter by source</span>
                <select
                  value={source}
                  onChange={event => setSource(event.target.value)}
                >
                  <option value="all">All sources</option>
                  <option value="agentz">AgentZ</option>
                  <option value="automation">Automation</option>
                  <option value="github">GitHub · connecting next</option>
                  <option value="cloudflare">
                    Cloudflare · connecting next
                  </option>
                  <option value="supabase">Supabase · connecting next</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="si-filter">
                <span className="sr-only">Filter by severity</span>
                <select
                  value={severity}
                  onChange={event => setSeverity(event.target.value)}
                >
                  <option value="all">Any signal</option>
                  <option value="warning">Needs attention</option>
                  <option value="info">Informational</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="si-search">
                <span className="sr-only">Search event names</span>
                <input
                  value={entity}
                  onChange={event => setEntity(event.target.value)}
                  placeholder="Find a workflow…"
                />
                {entity && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setEntity("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <button
                className="si-refresh"
                type="button"
                onClick={() => void loadFeed(true)}
                disabled={refreshing}
                aria-label="Refresh feed"
              >
                <RefreshCw size={15} className={refreshing ? "si-spin" : ""} />
              </button>
            </div>

            <div className="si-view-switch" role="group" aria-label="Feed view">
              <button
                type="button"
                className={viewMode === "signals" ? "is-active" : ""}
                aria-pressed={viewMode === "signals"}
                onClick={() => setViewMode("signals")}
              >
                <Activity size={14} /> Signals <span>{events.length}</span>
              </button>
              <button
                type="button"
                className={viewMode === "story" ? "is-active" : ""}
                aria-pressed={viewMode === "story"}
                onClick={() => setViewMode("story")}
              >
                <Sparkles size={14} /> StoryMode <span>{stories.length}</span>
              </button>
            </div>

            {error ? (
              <div className="si-feed-state">
                <div className="si-state-icon">
                  <ShieldCheck size={21} />
                </div>
                <h3>Your stream is private by design.</h3>
                <p>{error}</p>
                <Link href="/login?redirect=%2Fsi-feed" className="si-button">
                  Sign in to your feed <ArrowRight size={15} />
                </Link>
                <span className="si-state-foot">
                  No private operational data is exposed on this public page.
                </span>
              </div>
            ) : loading ? (
              <div className="si-feed-state si-loading" role="status">
                <span className="si-loader" /> Tuning into the stream…
              </div>
            ) : viewMode === "story" && stories.length ? (
              <div className="si-story-list">
                {stories.map(story => (
                  <article className="si-story" key={story.id}>
                    <header className="si-story-head">
                      <div>
                        <span className="si-story-kicker">
                          STORYMODE · TEXT NARRATIVE
                        </span>
                        <h3>{story.title}</h3>
                      </div>
                      <span className="si-story-count">
                        {story.events.length} SIGNAL
                        {story.events.length === 1 ? "" : "S"}
                      </span>
                    </header>
                    <div className="si-story-chapters">
                      {story.chapters.map(chapter => (
                        <section className="si-story-chapter" key={chapter.id}>
                          <span className="si-story-number">0{chapter.id}</span>
                          <div>
                            <h4>{chapter.title}</h4>
                            <p>{chapter.content}</p>
                          </div>
                        </section>
                      ))}
                    </div>
                    <footer className="si-story-foot">
                      <ShieldCheck size={13} />
                      Composed from this event trail only. No external AI call.
                    </footer>
                  </article>
                ))}
              </div>
            ) : viewMode === "signals" && events.length ? (
              <div className="si-event-list">
                {events.map(event => (
                  <article className="si-event" key={event.id}>
                    <div
                      className={`si-event-icon ${event.severity === "warning" ? "is-warning" : ""}`}
                    >
                      {event.severity === "warning" ? (
                        <CircleAlert size={17} />
                      ) : (
                        <Workflow size={17} />
                      )}
                    </div>
                    <div className="si-event-body">
                      <div className="si-event-meta">
                        <span className="si-event-source">
                          {displaySource(event.source)}
                        </span>
                        <span className="si-meta-divider">/</span>
                        <span>{event.transport}</span>
                        <span className="si-event-type">{event.type}</span>
                      </div>
                      <h3>{event.summary}</h3>
                      <p className="si-event-entity">{event.entity}</p>
                    </div>
                    <time className="si-event-time" dateTime={event.timestamp}>
                      <Clock3 size={13} />
                      {relativeTime(event.timestamp)}
                    </time>
                  </article>
                ))}
              </div>
            ) : (
              <div className="si-feed-state si-empty">
                <div className="si-state-icon">
                  {viewMode === "story" ? (
                    <Sparkles size={21} />
                  ) : (
                    <Rss size={21} />
                  )}
                </div>
                <h3>
                  {viewMode === "story"
                    ? "No grouped story yet."
                    : eventCount
                      ? "No signals match those filters."
                      : "The stream is warming up."}
                </h3>
                <p>
                  {viewMode === "story"
                    ? "As related signals arrive, they will be shaped into Origin, Journey, and Utility chapters."
                    : eventCount
                      ? "Try widening your filters to see more of the system."
                      : "AgentZ activity will appear here as it flows through the operational log."}
                </p>
                {eventCount > 0 && (
                  <button
                    type="button"
                    className="si-text-button"
                    onClick={() => {
                      setSource("all");
                      setSeverity("all");
                      setEntity("");
                    }}
                  >
                    Reset filters <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}

            <div className="si-feed-end">
              <span>
                <span className="si-feed-end-dot" />{" "}
                {feed
                  ? `${eventCount} signals in this window`
                  : "YOUR COMPANY, IN SIGNAL"}
              </span>
              <span>CURATED FOR CLARITY</span>
            </div>
          </div>

          <aside className="si-side-column">
            <section className="si-side-card si-manifesto">
              <div className="si-card-kicker">
                <Sparkles size={14} /> THE IDEA
              </div>
              <h2>Not another dashboard.</h2>
              <p>
                A shared memory for the systems that build, protect, and grow a
                company.
              </p>
              <div className="si-principles">
                <div>
                  <span>01</span>
                  <p>
                    <b>One event language</b>
                    <br />
                    Every source, one clear shape.
                  </p>
                </div>
                <div>
                  <span>02</span>
                  <p>
                    <b>Trust before automation</b>
                    <br />
                    Agents observe. The ledger remembers.
                  </p>
                </div>
                <div>
                  <span>03</span>
                  <p>
                    <b>Human-readable by default</b>
                    <br />
                    Less noise. More meaning.
                  </p>
                </div>
              </div>
            </section>

            <section className="si-side-card si-sources">
              <div className="si-sources-head">
                <div>
                  <div className="si-label">THE CONNECTOR MAP</div>
                  <h2>One feed, many worlds.</h2>
                </div>
                <span className="si-map-tag">IN PROGRESS</span>
              </div>
              <div className="si-connector-list">
                {connectors.map(({ name, icon: Icon, state, tone }) => (
                  <div className="si-connector" key={name}>
                    <span className={`si-connector-icon ${tone}`}>
                      <Icon size={16} />
                    </span>
                    <span className="si-connector-name">{name}</span>
                    <span className="si-connector-state">
                      <span />
                      {state}
                    </span>
                  </div>
                ))}
              </div>
              <div className="si-sources-foot">
                <Radio size={13} /> AgentZ + automation logs are the first
                connected signal.
              </div>
            </section>

            <section className="si-side-card si-offer">
              <div className="si-card-kicker">
                <ShieldCheck size={14} /> AUTHICHAIN OFFERING
              </div>
              <h2>Make trust visible on every product.</h2>
              <p>
                Start with five signed QR generations on the free plan, or talk
                with us about a product-trust pilot.
              </p>
              <div className="si-offer-actions">
                <Link href="/pricing">
                  Start free <ArrowRight size={13} />
                </Link>
                <Link href="/contact">Discuss a pilot</Link>
              </div>
            </section>

            <section className="si-side-card si-spotlight">
              <div className="si-card-kicker">
                <ShoppingBag size={14} /> AGENTIC COMMERCE
              </div>
              <h2>Useful tools, in the open.</h2>
              <p>
                Choose a topic to see a relevant MCP server. This choice stays
                in this page session; it is not saved or shared.
              </p>
              <label className="si-spotlight-select">
                <span>Show tools for</span>
                <select
                  value={spotlightTopic}
                  onChange={event => setSpotlightTopic(event.target.value)}
                >
                  <option value="">Choose a topic</option>
                  <option value="commerce">Agentic commerce</option>
                  <option value="trust">Trust &amp; identity</option>
                  <option value="developer">Developer tools</option>
                </select>
              </label>
              {selectedSpotlights.map(spotlight => (
                <a
                  className="si-spotlight-item"
                  href={spotlight.href}
                  target="_blank"
                  rel="noreferrer"
                  key={spotlight.name}
                >
                  <span className="si-spotlight-label">
                    AUTHICHAIN PICK · NOT A PAID PLACEMENT
                  </span>
                  <strong>{spotlight.name}</strong>
                  <span>{spotlight.detail}</span>
                  <span className="si-spotlight-link">Explore server →</span>
                </a>
              ))}
              <div className="si-spotlight-foot">
                Explore only. These servers are not connected to this feed.
                No clicks or topic choices are tracked.
              </div>
            </section>

            <section className="si-side-card si-consent">
              <div className="si-card-kicker">
                <LockKeyhole size={14} /> PERMISSION, NOT ASSUMPTION
              </div>
              <h2>
                Free to explore.
                <br />
                Yours to share.
              </h2>
              <p>
                E2E, B2E, and C2E exchange—in either direction, including barter
                data—stays off until everyone involved gives explicit, scoped
                permission. Consent must be revocable.
              </p>
              <div className="si-consent-flow">
                <span>E2E</span>
                <ArrowRight size={12} />
                <span>B2E</span>
                <ArrowRight size={12} />
                <span>C2E</span>
                <span className="si-consent-badge">OPT-IN ONLY</span>
              </div>
              {feed?.is_owner ? (
                <div className="si-consent-controls">
                  <p>Choose which sanitized signal sources may appear publicly:</p>
                  {[
                    ["agentz", "AgentZ"],
                    ["automation", "Automation"],
                    ["github", "GitHub"],
                  ].map(([sourceName, label]) => (
                    <label className="si-consent-toggle" key={sourceName}>
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        checked={consentedSources.includes(sourceName)}
                        disabled={consentBusy !== null}
                        onChange={event =>
                          void updateConsent(sourceName, event.target.checked)
                        }
                        aria-label={`Allow public sharing of ${label} signals`}
                      />
                    </label>
                  ))}
                  {consentMessage && (
                    <p className="si-consent-foot" role="status">
                      {consentMessage}
                    </p>
                  )}
                </div>
              ) : (
                <div className="si-consent-foot">
                  Public sharing is opt-in, source-specific, and revocable.
                </div>
              )}
            </section>

            <section className="si-share-card">
              <div className="si-share-card-glow" />
              <div className="si-share-card-content">
                <div className="si-card-kicker">
                  <Rss size={14} /> PASS IT ON
                </div>
                <h2>
                  Good systems
                  <br />
                  should be seen.
                </h2>
                <p>
                  Share the feed. Help shape what a transparent AI-native
                  company looks like.
                </p>
                <button type="button" onClick={() => void shareFeed()}>
                  {copied ? "Copied" : "Share AuthiChain SI"}{" "}
                  {copied ? <Check size={15} /> : <ArrowRight size={15} />}
                </button>
              </div>
              <div className="si-share-card-mark">
                <Activity size={40} />
              </div>
            </section>
          </aside>
        </section>

        <footer className="si-footer">
          <Link href="/" className="si-footer-brand">
            <span className="si-mark">
              <Activity size={14} />
            </span>
            AUTHICHAIN
          </Link>
          <span>
            AN OPEN SIGNAL FROM{" "}
            <a
              href="https://github.com/undone0603"
              target="_blank"
              rel="noreferrer"
            >
              @UNDONE0603
            </a>
          </span>
          <span>TRUST IS A VERB.</span>
        </footer>
      </div>
    </main>
  );
}
