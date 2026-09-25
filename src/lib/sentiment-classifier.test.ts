import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyReplyEmail,
  classifyReplyEmailHeuristic,
  describeClassifierError,
  failClosedNeutral,
  inboundReplyAction,
  isProbablyLegitimateReply,
  parseSentimentJson,
  resolveReplyClassifierBackend,
} from "./sentiment-classifier";

describe("resolveReplyClassifierBackend", () => {
  it("selects OpenAI when OPENAI_API_KEY is set", () => {
    const status = resolveReplyClassifierBackend({
      OPENAI_API_KEY: "sk-test",
    });
    expect(status.primary).toBe("openai");
    expect(status.paidLlmAvailable).toBe(true);
    expect(status.missingSecret).toBeUndefined();
    expect(status.waterfall[0]).toBe("openai");
  });

  it("names OPENAI_API_KEY as the missing paid secret and prefers Ollama when configured", () => {
    const status = resolveReplyClassifierBackend({
      OLLAMA_HOST: "http://127.0.0.1:11434",
      OLLAMA_MODEL: "llama3.2",
    });
    expect(status.primary).toBe("ollama");
    expect(status.paidLlmAvailable).toBe(false);
    expect(status.missingSecret).toBe("OPENAI_API_KEY");
    expect(status.waterfall).toEqual([
      "ollama",
      "heuristic",
      "neutral_fallback",
    ]);
  });

  it("skips probing localhost Ollama unless OLLAMA_HOST or OLLAMA_MODEL is set", () => {
    const status = resolveReplyClassifierBackend({});
    expect(status.primary).toBe("heuristic");
    expect(status.missingSecret).toBe("OPENAI_API_KEY");
    expect(status.waterfall).toEqual(["heuristic", "neutral_fallback"]);
  });
});

describe("Workers AI (free primary)", () => {
  const positive = {
    sentiment: "positive",
    objectionType: null,
    objectionDetails: null,
    confidence: 0.9,
    reasoning: "Asks for a call.",
  };

  it("puts workers_ai first in the waterfall when the binding is present", () => {
    const ai = { run: vi.fn() };
    const status = resolveReplyClassifierBackend(
      { OPENAI_API_KEY: "sk-test" },
      ai
    );
    expect(status.primary).toBe("workers_ai");
    expect(status.workersAiAvailable).toBe(true);
    expect(status.waterfall).toEqual([
      "workers_ai",
      "openai",
      "heuristic",
      "neutral_fallback",
    ]);
  });

  it("classifies with Workers AI and never calls OpenAI", async () => {
    const ai = { run: vi.fn(async () => ({ response: positive })) };
    const generateOpenAI = vi.fn();
    const result = await classifyReplyEmail("Can we talk?", "Re: proposal", {
      env: { OPENAI_API_KEY: "sk-test" },
      workersAI: ai,
      generateOpenAI,
    });
    expect(result.provider).toBe("workers_ai");
    expect(result.sentiment).toBe("positive");
    expect(result.fallbackReason).toBeUndefined();
    expect(generateOpenAI).not.toHaveBeenCalled();
    expect(ai.run).toHaveBeenCalledWith(
      "@cf/meta/llama-3.1-8b-instruct",
      expect.objectContaining({
        response_format: expect.objectContaining({ type: "json_schema" }),
      })
    );
  });

  it("parses a text completion when JSON Mode is not honoured", async () => {
    const ai = {
      run: vi.fn(async () => ({
        response: "```json\n" + JSON.stringify(positive) + "\n```",
      })),
    };
    const result = await classifyReplyEmail("Can we talk?", "Re: proposal", {
      env: {},
      workersAI: ai,
    });
    expect(result.provider).toBe("workers_ai");
  });

  it("falls back to the heuristic and records why when Workers AI fails", async () => {
    const ai = {
      run: vi.fn(async () => {
        throw new Error("4006: daily free allocation exceeded");
      }),
    };
    const result = await classifyReplyEmail(
      "Let's schedule a call",
      "Re: proposal",
      { env: {}, workersAI: ai }
    );
    expect(result.provider).toBe("heuristic");
    expect(result.fallbackReason).toBe(
      "workers_ai: 4006: daily free allocation exceeded"
    );
  });

  it("chains both reasons when Workers AI and OpenAI both fail", async () => {
    const result = await classifyReplyEmail("Hi", "Re: proposal", {
      env: { OPENAI_API_KEY: "sk-test" },
      workersAI: { run: vi.fn(async () => ({ response: "" })) },
      generateOpenAI: async () => {
        throw new Error("no credits");
      },
    });
    expect(result.provider).toBe("heuristic");
    expect(result.fallbackReason).toBe(
      "workers_ai: Workers AI returned an empty completion; openai: no credits"
    );
  });
});

describe("fail-closed classifier", () => {
  it("never throws and always returns a valid neutral payload", () => {
    const result = failClosedNeutral(
      new Error("OPENAI_API_KEY is not configured")
    );
    expect(result.sentiment).toBe("neutral");
    expect(result.objectionType).toBeNull();
    expect(result.confidence).toBe(0.3);
    expect(result.provider).toBe("neutral_fallback");
    expect(result.reasoning).toContain("OPENAI_API_KEY");
  });

  it("stays live via heuristic when paid LLM and Ollama are unavailable", async () => {
    const result = await classifyReplyEmail(
      "thanks, we are interested",
      "RE: Proposal",
      {
        env: {},
        fetchImpl: () => {
          throw new Error("ollama down");
        },
        generateOpenAI: async () => {
          throw new Error("openai should not run");
        },
      }
    );
    // Heuristic still runs after Ollama fails — path stays live.
    expect(result.provider).toBe("heuristic");
    expect(result.sentiment).toBe("positive");
  });

  it("fail-closes to neutral when the heuristic also throws (agentz pattern)", async () => {
    const result = await classifyReplyEmail("body", "subject", {
      env: {},
      fetchImpl: async () => {
        throw new Error("offline");
      },
      heuristic: () => {
        throw new Error("heuristic crashed");
      },
    });
    expect(result.provider).toBe("neutral_fallback");
    expect(result.sentiment).toBe("neutral");
    expect(result.reasoning).toContain("heuristic crashed");
  });
});

describe("classifyReplyEmailHeuristic", () => {
  it("classifies explicit interest as positive", () => {
    const result = classifyReplyEmailHeuristic(
      "Thanks — we are very interested and would like to schedule a demo.",
      "RE: Proposal"
    );
    expect(result.sentiment).toBe("positive");
    expect(result.provider).toBe("heuristic");
  });

  it("classifies opt-out as negative, even if it starts with thanks", () => {
    const result = classifyReplyEmailHeuristic(
      "Thanks but we are not interested. Please remove me.",
      "RE: Proposal"
    );
    expect(result.sentiment).toBe("negative");
  });

  it("classifies a budget blocker as objection/budget", () => {
    const result = classifyReplyEmailHeuristic(
      "This is too expensive for us this year.",
      "RE: Proposal"
    );
    expect(result.sentiment).toBe("objection");
    expect(result.objectionType).toBe("budget");
  });

  it("stays fail-closed (neutral) on polite or info-seeking copy", () => {
    const result = classifyReplyEmailHeuristic(
      "Thanks for sending this over. What is the price?",
      "RE: Proposal"
    );
    expect(result.sentiment).toBe("neutral");
    expect(result.provider).toBe("heuristic");
  });
});

describe("parseSentimentJson", () => {
  it("accepts a bare JSON object", () => {
    const result = parseSentimentJson(
      JSON.stringify({
        sentiment: "objection",
        objectionType: "timeline",
        objectionDetails: "next quarter",
        confidence: 0.9,
        reasoning: "Asked to wait.",
      }),
      "openai"
    );
    expect(result.sentiment).toBe("objection");
    expect(result.objectionType).toBe("timeline");
    expect(result.provider).toBe("openai");
  });

  it("strips markdown fences", () => {
    const result = parseSentimentJson(
      '```json\n{"sentiment":"positive","objectionType":null,"confidence":0.8,"reasoning":"ok"}\n```',
      "ollama"
    );
    expect(result.sentiment).toBe("positive");
    expect(result.provider).toBe("ollama");
  });

  it("rejects an unknown sentiment so the caller can fail closed", () => {
    expect(() =>
      parseSentimentJson('{"sentiment":"excited"}', "openai")
    ).toThrow(/Invalid sentiment/);
  });
});

describe("classifyReplyEmail waterfall", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses OpenAI when the key is present and the completion is valid", async () => {
    const result = await classifyReplyEmail("body", "subject", {
      env: { OPENAI_API_KEY: "sk-test" },
      generateOpenAI: async () =>
        JSON.stringify({
          sentiment: "positive",
          objectionType: null,
          confidence: 0.91,
          reasoning: "Ready to proceed.",
        }),
    });
    expect(result.provider).toBe("openai");
    expect(result.sentiment).toBe("positive");
    expect(result.confidence).toBeCloseTo(0.91);
  });

  it("reports why OpenAI was skipped when it falls back, with the key redacted", async () => {
    const result = await classifyReplyEmail(
      "thanks, we are interested",
      "RE: Proposal",
      {
        env: { OPENAI_API_KEY: "sk-test" },
        generateOpenAI: async () => {
          throw new Error(
            "Incorrect API key provided: sk-proj-abc123XYZ. Check your key."
          );
        },
      }
    );
    expect(result.provider).toBe("heuristic");
    expect(result.fallbackReason).toBe(
      "openai: Incorrect API key provided: sk-[redacted]. Check your key."
    );
  });

  it("leaves fallbackReason unset when OpenAI succeeds", async () => {
    const result = await classifyReplyEmail("body", "subject", {
      env: { OPENAI_API_KEY: "sk-test" },
      generateOpenAI: async () =>
        JSON.stringify({
          sentiment: "neutral",
          objectionType: null,
          confidence: 0.5,
        }),
    });
    expect(result.fallbackReason).toBeUndefined();
  });

  it("falls through to Ollama when OpenAI is unset", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              sentiment: "objection",
              objectionType: "decision_maker",
              objectionDetails: "needs CFO",
              confidence: 0.7,
              reasoning: "Needs sign-off.",
            }),
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    const result = await classifyReplyEmail(
      "Need to run this by our CFO",
      "RE: Proposal",
      {
        env: { OLLAMA_HOST: "http://127.0.0.1:11434" },
        fetchImpl,
      }
    );
    expect(result.provider).toBe("ollama");
    expect(result.sentiment).toBe("objection");
    expect(result.objectionType).toBe("decision_maker");
  });

  it("does not call OpenAI or Ollama when neither is configured", async () => {
    const generateOpenAI = vi.fn(async () => {
      throw new Error("should not be called");
    });
    const fetchImpl = vi.fn(async () => {
      throw new Error("should not probe ollama");
    });
    const result = await classifyReplyEmail(
      "not interested, unsubscribe",
      "RE: Proposal",
      {
        env: {},
        generateOpenAI,
        fetchImpl,
      }
    );
    expect(generateOpenAI).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.provider).toBe("heuristic");
    expect(result.sentiment).toBe("negative");
  });
});

describe("isProbablyLegitimateReply", () => {
  it("accepts a real reply", () => {
    expect(
      isProbablyLegitimateReply("RE: Proposal", "We are interested.")
    ).toBe(true);
  });

  it("rejects out-of-office and bounces", () => {
    expect(
      isProbablyLegitimateReply("Out of Office", "I am currently out")
    ).toBe(false);
    expect(
      isProbablyLegitimateReply("Delivery failed", "Mail delivery failed")
    ).toBe(false);
  });

  it("rejects an empty body", () => {
    expect(isProbablyLegitimateReply("RE: Proposal", "  ")).toBe(false);
  });
});

describe("inboundReplyAction", () => {
  it("routes positive/objection with a lead to nurture", () => {
    expect(inboundReplyAction("positive", 12)).toBe("nurture");
    expect(inboundReplyAction("objection", 12)).toBe("nurture");
  });

  it("fail-closes unmatched or lukewarm replies to manual review", () => {
    expect(inboundReplyAction("positive", null)).toBe("manual_review");
    expect(inboundReplyAction("neutral", 12)).toBe("manual_review");
    expect(inboundReplyAction("negative", 12)).toBe("manual_review");
  });
});

describe("describeClassifierError", () => {
  it("redacts key fragments and caps the length", () => {
    const text = describeClassifierError(
      new Error(`bad key sk-live_1234 ${"x".repeat(500)}`)
    );
    expect(text).not.toContain("sk-live_1234");
    expect(text.length).toBeLessThanOrEqual(300);
  });
});
