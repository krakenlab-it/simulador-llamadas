import type { ScenarioAuthoringDraft } from "@/lib/scenarios/authoring";
import { AGENT_TOOL_CATALOG, toolLabel } from "./tools";
import type {
  AgentHarnessSettings,
  AgentToolId,
  AgentToolTrace,
} from "./types";

export interface AgentVisibilityView {
  showSystemPrompt: boolean;
  showTools: boolean;
  showContext: boolean;
  showTraces: boolean;
  systemPrompt: string;
  enabledToolLabels: string[];
  contextPack: string;
  traces: AgentToolTrace[];
  draft: ScenarioAuthoringDraft | null;
}

/**
 * What the frontend may render for tuning. Happy-path defaults hide tools,
 * context, and traces so a first run is just chat + the system prompt.
 */
export function buildVisibilityView(input: {
  settings: AgentHarnessSettings;
  contextPack: string;
  traces: AgentToolTrace[];
  draft: ScenarioAuthoringDraft | null;
}): AgentVisibilityView {
  const { settings } = input;
  const enabled = new Set<AgentToolId>(settings.enabledTools);

  return {
    showSystemPrompt: settings.visibility.showSystemPrompt,
    showTools: settings.visibility.showTools,
    showContext: settings.visibility.showContext,
    showTraces: settings.visibility.showTraces,
    systemPrompt: settings.systemPrompt,
    enabledToolLabels: AGENT_TOOL_CATALOG.filter((tool) => enabled.has(tool.id)).map(
      (tool) => toolLabel(tool.id),
    ),
    contextPack: input.contextPack,
    traces: settings.visibility.showTraces ? input.traces : [],
    draft: input.draft,
  };
}
