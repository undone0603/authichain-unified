export type SiFeedEvent = {
  id: string;
  timestamp: string;
  source: string;
  transport: string;
  type: string;
  severity: string;
  entity: string;
  summary: string;
  data: { status: string };
  status: string;
  agent: string | null;
};

type StoryChapter = { id: number; title: string; content: string };

export type FeedStory = {
  id: string;
  title: string;
  source: string;
  day: string;
  events: SiFeedEvent[];
  chapters: StoryChapter[];
};

export function displaySource(source: string) {
  return source === "agentz" ? "AgentZ" : "Automation";
}

export function buildStories(events: SiFeedEvent[]): FeedStory[] {
  const groups = new Map<string, SiFeedEvent[]>();

  for (const event of events) {
    const day = event.timestamp.slice(0, 10);
    const id = `${event.source}:${day}`;
    groups.set(id, [...(groups.get(id) ?? []), event]);
  }

  return Array.from(groups.entries()).map(([id, group]) => {
    const timeline = [...group].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const first = timeline[0];
    const last = timeline[timeline.length - 1];
    const successes = timeline.filter(event =>
      ["success", "succeeded", "complete", "completed"].includes(
        event.status.toLowerCase()
      )
    ).length;
    const warnings = timeline.filter(
      event => event.severity === "warning"
    ).length;
    const other = timeline.length - successes - warnings;
    const workflows = Array.from(new Set(timeline.map(event => event.entity)));
    const day = new Date(
      `${first.timestamp.slice(0, 10)}T12:00:00Z`
    ).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return {
      id,
      title: `${displaySource(first.source)} · ${day}`,
      source: first.source,
      day,
      events: timeline,
      chapters: [
        {
          id: 1,
          title: "Origin",
          content: `The first signal arrived at ${new Date(first.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}: ${first.summary}.`,
        },
        {
          id: 2,
          title: "Journey",
          content: `${timeline.length} event${timeline.length === 1 ? "" : "s"} traced across ${
            workflows.length
          } workflow${workflows.length === 1 ? "" : "s"}: ${workflows.slice(0, 3).join(", ")}${
            workflows.length > 3 ? ", and more" : ""
          }.`,
        },
        {
          id: 3,
          title: "Utility",
          content: `${successes} completed, ${warnings} flagged for attention${other ? `, ${other} with another status` : ""}. The latest signal: ${last.summary}.`,
        },
      ],
    };
  });
}
