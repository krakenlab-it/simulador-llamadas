import { NextResponse } from "next/server";
import { parseAuthoringBody } from "@/lib/scenarios/authoring";
import { ScenarioRepository } from "@/lib/scenarios";
import type { CreateCustomScenarioInput } from "@/lib/scenarios/types";
import { toPublicRouteError, withPgClient } from "@/lib/session";

export async function GET() {
  try {
    const scenarios = await withPgClient(async (client) => {
      const repo = new ScenarioRepository(client);
      return repo.listScenarios();
    });
    return NextResponse.json({ scenarios });
  } catch (error) {
    const mapped = toPublicRouteError(
      error,
      "No se pudieron cargar los escenarios.",
    );
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CreateCustomScenarioInput>;
    const parsed = parseAuthoringBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const scenario = await withPgClient(async (client) => {
      const repo = new ScenarioRepository(client);
      return repo.createCustom(parsed.input);
    });

    return NextResponse.json(scenario, { status: 201 });
  } catch (error) {
    const mapped = toPublicRouteError(error, "No se pudo crear el escenario.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
