import { AGENT_TOOL_CATALOG } from "./tools";
import type { AgentChatResponse, AgentHarnessSettings } from "./types";

export function buildVisibilityView(
  settings: AgentHarnessSettings,
  response: Pick<AgentChatResponse, "contextPack" | "traces" | "roles">,
) {
  return {
    tools: settings.visibility.showTools
      ? AGENT_TOOL_CATALOG.filter((tool) =>
          settings.enabledTools.includes(tool.id),
        )
      : [],
    contextPack: settings.visibility.showContext ? response.contextPack : "",
    traces: settings.visibility.showTraces ? response.traces : [],
    roles: settings.visibility.showContext ? response.roles : null,
  };
}
