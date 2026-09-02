import { describe, expect, it } from "vitest";
import {
  beginStarting,
  canNavigateTo,
  closeBuilder,
  enterCall,
  enterDetail,
  enterResults,
  initialFlowState,
  navigate,
  openBuilder,
  resetToHome,
  resetToTrain,
} from "@/lib/frontend/flow";

describe("app flow state machine", () => {
  it("starts on the home dashboard with idle phase", () => {
    const state = initialFlowState();
    expect(state.view).toBe("home");
    expect(state.phase).toBe("idle");
    expect(state.hasActiveSession).toBe(false);
  });

  it("allows navigation between home and train when idle", () => {
    const state = initialFlowState();
    expect(canNavigateTo(state, "train")).toBe(true);
    const train = navigate(state, "train");
    expect(train.view).toBe("train");
    expect(navigate(train, "home").view).toBe("home");
  });

  it("blocks navigation while starting a call", () => {
    const starting = beginStarting(initialFlowState());
    expect(starting.phase).toBe("starting");
    expect(canNavigateTo(starting, "home")).toBe(false);
  });

  it("enters call and blocks leaving until results", () => {
    const inCall = enterCall();
    expect(inCall.view).toBe("call");
    expect(inCall.phase).toBe("in-call");
    expect(canNavigateTo(inCall, "train")).toBe(false);
    expect(canNavigateTo(inCall, "home")).toBe(false);
  });

  it("moves from call to results after hang up", () => {
    enterCall();
    const results = enterResults();
    expect(results.view).toBe("results");
    expect(canNavigateTo(results, "home")).toBe(true);
    expect(canNavigateTo(results, "call")).toBe(false);
  });

  it("opens a persisted call on the detail view", () => {
    const detail = enterDetail();
    expect(detail.view).toBe("detail");
    expect(canNavigateTo(detail, "home")).toBe(true);
    expect(canNavigateTo(detail, "call")).toBe(false);
  });

  it("opens and closes the scenario builder from train", () => {
    const train = navigate(initialFlowState(), "train");
    const builder = openBuilder(train);
    expect(builder.view).toBe("builder");
    expect(closeBuilder(builder).view).toBe("train");
  });

  it("cannot open builder during an active call", () => {
    const inCall = enterCall();
    expect(openBuilder(inCall)).toEqual(inCall);
  });

  it("resets to home after reviewing a session", () => {
    const afterSession = enterResults();
    const reset = resetToHome();
    expect(reset.view).toBe("home");
    expect(reset.hasActiveSession).toBe(false);
    expect(afterSession.hasActiveSession).toBe(true);
  });

  it("resets to train to start another practice", () => {
    const reset = resetToTrain();
    expect(reset.view).toBe("train");
    expect(reset.phase).toBe("idle");
  });
});
