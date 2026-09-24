import type { ScenarioAuthoringDraft } from "@/lib/scenarios/authoring";
import type { HarnessState } from "./types";

export function resolveHarnessState(input: {
  draft: ScenarioAuthoringDraft | null;
  applied: boolean;
  comparing: boolean;
  messageCount: number;
}): HarnessState {
  if (input.comparing) return "comparing";
  if (input.applied) return "ready";
  if (input.draft) return "proposing";
  if (input.messageCount > 0) return "gathering";
  return "idle";
}
