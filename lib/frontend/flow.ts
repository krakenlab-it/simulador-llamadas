/**
 * Screen flow for the sales-call trainer UI.
 * Pure state machine — easy to test without rendering React.
 */

export type AppView =
  | "home"
  | "train"
  | "history"
  | "builder"
  | "call"
  | "results"
  | "detail";

export type TrainingPhase = "idle" | "starting" | "in-call" | "evaluating";

export interface FlowState {
  view: AppView;
  phase: TrainingPhase;
  hasActiveSession: boolean;
}

export function initialFlowState(): FlowState {
  return {
    view: "home",
    phase: "idle",
    hasActiveSession: false,
  };
}

export function canNavigateTo(
  from: FlowState,
  target: AppView,
): boolean {
  if (from.phase === "starting" || from.phase === "evaluating") {
    return false;
  }
  if (from.view === "call" && target !== "results") {
    return false;
  }
  if (
    (from.view === "results" || from.view === "detail") &&
    (target === "call" || target === "builder")
  ) {
    return false;
  }
  return true;
}

export function navigate(
  state: FlowState,
  target: AppView,
): FlowState {
  if (!canNavigateTo(state, target)) return state;
  return { ...state, view: target };
}

export function beginStarting(state: FlowState): FlowState {
  return { ...state, phase: "starting" };
}

export function enterCall(): FlowState {
  return {
    view: "call",
    phase: "in-call",
    hasActiveSession: true,
  };
}

export function enterResults(): FlowState {
  return {
    view: "results",
    phase: "idle",
    hasActiveSession: true,
  };
}

export function enterDetail(): FlowState {
  return {
    view: "detail",
    phase: "idle",
    hasActiveSession: true,
  };
}

export function finishEvaluating(state: FlowState): FlowState {
  return { ...state, phase: "idle" };
}

export function resetToHome(): FlowState {
  return initialFlowState();
}

export function resetToTrain(): FlowState {
  return {
    view: "train",
    phase: "idle",
    hasActiveSession: false,
  };
}

export function openBuilder(state: FlowState): FlowState {
  if (state.phase !== "idle" || state.view === "call") return state;
  return { ...state, view: "builder" };
}

export function closeBuilder(state: FlowState): FlowState {
  if (state.view !== "builder") return state;
  return { ...state, view: "train" };
}
