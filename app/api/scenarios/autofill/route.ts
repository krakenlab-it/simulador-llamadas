import { autofillAuthoringDraft } from "@/lib/scenarios/authoring-autofill";
import type { ScenarioAuthoringDraft } from "@/lib/scenarios/authoring";
import { validateAuthoringDraft } from "@/lib/scenarios/authoring";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ScenarioAuthoringDraft>;
    const draft = body as ScenarioAuthoringDraft;
    if (!draft.industry?.trim() || !draft.clientProblem?.trim()) {
      return NextResponse.json(
        { error: "Completa al menos industria y problema del cliente." },
        { status: 400 },
      );
    }
    const patch = await autofillAuthoringDraft(draft);
    const merged: ScenarioAuthoringDraft = { ...draft, ...patch };
    const validation = validateAuthoringDraft(merged);
    return NextResponse.json({
      patch,
      validationError: validation,
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo completar el autofill." },
      { status: 500 },
    );
  }
}
