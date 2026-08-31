import { NextResponse } from "next/server";
import { ScenarioRepository } from "@/lib/scenarios";
import { withPgClient } from "@/lib/session";

export async function GET() {
  try {
    const scenarios = await withPgClient(async (client) => {
      const repo = new ScenarioRepository(client);
      return repo.listScenarios();
    });
    return NextResponse.json({ scenarios });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface CreateScenarioBody {
  industry: string;
  productSold: string;
  clientName: string;
  clientTitle: string;
  companyContext: string;
  temperament: string;
  difficultyLabel: string;
  clientProblem: string;
  objections: string[];
  winCriteria: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateScenarioBody;

    const required = [
      "industry",
      "productSold",
      "clientName",
      "clientTitle",
      "companyContext",
      "temperament",
      "clientProblem",
      "winCriteria",
    ] as const;

    for (const field of required) {
      if (!body[field]?.trim()) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 },
        );
      }
    }

    const scenario = await withPgClient(async (client) => {
      const repo = new ScenarioRepository(client);

      return repo.createCustom({
        industry: body.industry.trim(),
        productSold: body.productSold.trim(),
        clientName: body.clientName.trim(),
        clientTitle: body.clientTitle.trim(),
        companyContext: body.companyContext.trim(),
        temperament: body.temperament.trim(),
        difficultyLabel: body.difficultyLabel?.trim() || "Media",
        clientProblem: body.clientProblem.trim(),
        objections: (body.objections ?? []).map((o) => o.trim()).filter(Boolean),
        winCriteria: body.winCriteria.trim(),
      });
    });

    return NextResponse.json(scenario, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
