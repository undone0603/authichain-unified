import { describe, expect, it } from "vitest";
import { buildStories, type SiFeedEvent } from "./si-storymode";

const event = (overrides: Partial<SiFeedEvent>): SiFeedEvent => ({
  id: "event",
  timestamp: "2026-10-02T12:00:00.000Z",
  source: "agentz",
  transport: "schedule",
  type: "automation.run_completed",
  severity: "info",
  entity: "agentz_check",
  summary: "AgentZ check completed",
  data: { status: "success" },
  status: "success",
  agent: "AgentZ",
  ...overrides,
});

describe("SI Feed StoryMode", () => {
  it("groups same-source daily signals into Origin, Journey, and Utility chapters", () => {
    const stories = buildStories([
      event({
        id: "later",
        timestamp: "2026-10-02T18:00:00.000Z",
        summary: "The final check reported a failure",
        status: "failure",
        severity: "warning",
      }),
      event({
        id: "earlier",
        timestamp: "2026-10-02T08:00:00.000Z",
        entity: "agentz_startup",
        summary: "The first check completed",
      }),
      event({
        id: "next-day",
        timestamp: "2026-10-03T08:00:00.000Z",
        entity: "agentz_startup",
      }),
    ]);

    expect(stories).toHaveLength(2);
    expect(stories[0].events.map(item => item.id)).toEqual([
      "earlier",
      "later",
    ]);
    expect(stories[0].chapters.map(chapter => chapter.title)).toEqual([
      "Origin",
      "Journey",
      "Utility",
    ]);
    expect(stories[0].chapters[0].content).toContain(
      "The first check completed"
    );
    expect(stories[0].chapters[1].content).toContain("2 workflows");
    expect(stories[0].chapters[2].content).toContain("1 flagged for attention");
    expect(stories[0].chapters[2].content).toContain(
      "The final check reported a failure"
    );
  });

  it("keeps different sources in separate stories", () => {
    const stories = buildStories([
      event({ id: "agentz" }),
      event({ id: "automation", source: "automation", agent: null }),
    ]);

    expect(stories).toHaveLength(2);
    expect(stories.map(story => story.source)).toEqual([
      "agentz",
      "automation",
    ]);
  });

  it("returns no story for an empty feed", () => {
    expect(buildStories([])).toEqual([]);
  });
});
