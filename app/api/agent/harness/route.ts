import { NextResponse } from "next/server";
import {
  AGENT_PRESETS,
  AGENT_TOOL_CATALOG,
  DEFAULT_AGENT_SETTINGS,
} from "@/lib/agent";
import { AGENT_ENV_NAMES, readProviderAvailability } from "@/lib/agent/availability";

export async function GET() {
  return NextResponse.json({
    defaultSettings: DEFAULT_AGENT_SETTINGS,
    presets: AGENT_PRESETS,
    tools: AGENT_TOOL_CATALOG,
    availability: readProviderAvailability(),
    envNames: [...AGENT_ENV_NAMES],
  });
}
