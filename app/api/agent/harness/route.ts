import { NextResponse } from "next/server";
import {
  AGENT_ENV_NAMES,
  AGENT_PRESETS,
  AGENT_TOOL_CATALOG,
  DEFAULT_AGENT_SETTINGS,
  DEFAULT_GATEWAY_DEEPSEEK_MODEL,
  readProviderAvailability,
} from "@/lib/agent";

export async function GET() {
  return NextResponse.json({
    defaultSettings: DEFAULT_AGENT_SETTINGS,
    defaultModel: DEFAULT_GATEWAY_DEEPSEEK_MODEL,
    presets: Object.values(AGENT_PRESETS),
    tools: AGENT_TOOL_CATALOG,
    availability: readProviderAvailability(),
    envNames: AGENT_ENV_NAMES,
  });
}
