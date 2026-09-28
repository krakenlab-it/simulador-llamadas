import { NextResponse } from "next/server";
import { ScenarioRepository } from "@/lib/scenarios";
import {
  PresetScenarioLockedError,
  ScenarioNotFoundError,
} from "@/lib/scenarios/repository";
import { toPublicRouteError, withPgClient } from "@/lib/session";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

interface LifecycleBody {
  active?: boolean;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const body = (await request.json()) as LifecycleBody;
    if (typeof body.active !== "boolean") {
      return NextResponse.json(
        { error: "active (boolean) is required" },
        { status: 400 },
      );
    }

    const scenario = await withPgClient(async (client) => {
      const repo = new ScenarioRepository(client);
      return repo.setDeactivated(slug, !body.active);
    });

    return NextResponse.json(scenario);
  } catch (error) {
    if (error instanceof ScenarioNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PresetScenarioLockedError) {
      return NextResponse.json(
        { error: "Los casos de la clínica no se pueden dar de baja." },
        { status: 403 },
      );
    }
    const mapped = toPublicRouteError(
      error,
      "No se pudo actualizar el estado del escenario.",
    );
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
