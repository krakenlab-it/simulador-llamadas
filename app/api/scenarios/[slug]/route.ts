import { NextResponse } from "next/server";
import { parseAuthoringBody } from "@/lib/scenarios/authoring";
import { ScenarioRepository } from "@/lib/scenarios";
import {
  PresetScenarioLockedError,
  ScenarioNotFoundError,
} from "@/lib/scenarios/repository";
import type { CreateCustomScenarioInput } from "@/lib/scenarios/types";
import { withPgClient } from "@/lib/session";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const scenario = await withPgClient(async (client) => {
      const repo = new ScenarioRepository(client);
      return repo.getBySlug(slug);
    });

    if (!scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    return NextResponse.json(scenario);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const body = (await request.json()) as Partial<CreateCustomScenarioInput>;
    const parsed = parseAuthoringBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const scenario = await withPgClient(async (client) => {
      const repo = new ScenarioRepository(client);
      return repo.updateCustom({ ...parsed.input, slug });
    });

    return NextResponse.json(scenario);
  } catch (error) {
    if (error instanceof ScenarioNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PresetScenarioLockedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
