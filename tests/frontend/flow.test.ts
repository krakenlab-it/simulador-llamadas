import { describe, expect, it } from "vitest";
import {
  beginStarting,
  canNavigateTo,
  closeBuilder,
  enterCall,
  enterResults,
  initialFlowState,
  navigate,
  openBuilder,
  resetToTrain,
} from "@/lib/frontend/flow";

describe("app flow state machine", () => {
  it("starts on train view with idle phase", () => {
    const state = initialFlowState();
    expect(state.view).toBe("train");
    expect(state.phase).toBe("idle");
    expect(state.hasActiveSession).toBe(false);
  });

  it("allows navigation between train and history when idle", () => {
    const state = initialFlowState();
    expect(canNavigateTo(state, "history")).toBe(true);
    const history = navigate(state, "history");
    expect(history.view).toBe("history");
    expect(navigate(history, "train").view).toBe("train");
  });

  it("blocks navigation while starting a call", () => {
    const starting = beginStarting(initialFlowState());
    expect(starting.phase).toBe("starting");
    expect(canNavigateTo(starting, "history")).toBe(false);
  });

  it("enters call and blocks leaving until results", () => {
    const inCall = enterCall();
    expect(inCall.view).toBe("call");
    expect(inCall.phase).toBe("in-call");
    expect(canNavigateTo(inCall, "train")).toBe(false);
    expect(canNavigateTo(inCall, "history")).toBe(false);
  });

  it("moves from call to results after hang up", () => {
    enterCall();
    const results = enterResults();
    expect(results.view).toBe("results");
    expect(canNavigateTo(results, "train")).toBe(true);
    expect(canNavigateTo(results, "call")).toBe(false);
  });

  it("opens and closes the scenario builder from train", () => {
    const state = initialFlowState();
    const builder = openBuilder(state);
    expect(builder.view).toBe("builder");
    expect(closeBuilder(builder).view).toBe("train");
  });

  it("cannot open builder during an active call", () => {
    const inCall = enterCall();
    expect(openBuilder(inCall)).toEqual(inCall);
  });

  it("resets to train after finishing a session", () => {
    const afterSession = enterResults();
    const reset = resetToTrain();
    expect(reset.view).toBe("train");
    expect(reset.hasActiveSession).toBe(false);
    expect(afterSession.hasActiveSession).toBe(true);
  });
});
