import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODE,
  isFailClosedWorkflow,
  parseModeArgs,
  resolveAgentzMode,
  withModeQuery,
} from "./agentz-mode";

describe("claw AgentZ mode contract", () => {
  it("defaults chat run args to dry-run (not confirm)", () => {
    expect(parseModeArgs([])).toEqual({ mode: DEFAULT_MODE, live: false });
    expect(parseModeArgs(undefined)).toEqual({
      mode: DEFAULT_MODE,
      live: false,
    });
  });

  it("parses positional and --mode / --live flags", () => {
    expect(parseModeArgs(["confirm"])).toEqual({
      mode: "confirm",
      live: false,
    });
    expect(parseModeArgs(["--mode", "auto"])).toEqual({
      mode: "auto",
      live: false,
    });
    expect(parseModeArgs(["auto", "--live"])).toEqual({
      mode: "auto",
      live: true,
    });
  });

  it("appends mode as a query param so FastAPI honors it", () => {
    expect(withModeQuery("/workflows/stripe_mcp/run", "confirm")).toBe(
      "/workflows/stripe_mcp/run?mode=confirm"
    );
    expect(withModeQuery("/architect/cycle", "dry-run", true)).toBe(
      "/architect/cycle?mode=dry-run&live=true"
    );
  });

  it("fail-closes architect and *email* unless live is explicit", () => {
    expect(isFailClosedWorkflow("architect_cycle")).toBe(true);
    expect(isFailClosedWorkflow("strainchain_email_pitch")).toBe(true);
    expect(isFailClosedWorkflow("stripe_mcp")).toBe(false);
    expect(
      resolveAgentzMode({
        requested: "auto",
        failClosed: true,
      })
    ).toEqual({ mode: "dry-run", coerced: true });
    expect(
      resolveAgentzMode({
        requested: "auto",
        live: true,
        failClosed: true,
      })
    ).toEqual({ mode: "auto", coerced: false });
  });
});
