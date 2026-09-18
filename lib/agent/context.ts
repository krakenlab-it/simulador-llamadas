import type { ScenarioAuthoringDraft } from "@/lib/scenarios/authoring";
import { DEFAULT_CLIENT_LAYER_SETTINGS } from "./client-layer";
import type { AgentHarnessSettings, PublicScenarioSummary } from "./types";

const CATALOG_LIMIT = 12;

export function packAgentContext(input: {
  settings: AgentHarnessSettings;
  catalog: PublicScenarioSummary[];
  draft: ScenarioAuthoringDraft | null;
  teamHint?: string | null;
}): string {
  const sections: string[] = [];

  if (input.settings.includeCatalog && input.catalog.length > 0) {
    const lines = input.catalog.slice(0, CATALOG_LIMIT).map((item) => {
      const kind = item.isPreset ? "PREFILLED" : "personalizado";
      return `- ${item.clientName} (${item.clientTitle}) · ${item.industry || "sin industria"} · ${kind} · ${item.slug}`;
    });
    sections.push(`Catálogo (máx. ${CATALOG_LIMIT}):\n${lines.join("\n")}`);
  }

  if (input.settings.includeDraft && input.draft) {
    sections.push(
      [
        "Borrador actual:",
        `- Cliente: ${input.draft.clientName} · ${input.draft.clientTitle}`,
        `- Empresa: ${input.draft.companyContext}`,
        `- Industria / producto: ${input.draft.industry} / ${input.draft.productSold}`,
        `- Problema: ${input.draft.clientProblem}`,
        `- Tipo: ${input.draft.callType}`,
        `- Éxito: ${input.draft.winCriteria}`,
      ].join("\n"),
    );
  }

  if (input.settings.includeVoiceSettings) {
    const voice = input.settings.voiceAgent;
    const layer = voice.clientLayer ?? DEFAULT_CLIENT_LAYER_SETTINGS;
    sections.push(
      [
        "Voz del cliente simulado:",
        `- Idioma: ${voice.language}`,
        `- Personalidad: ${voice.personality}`,
        `- Ritmo: ${voice.speakingRate}`,
        `- Dificultad: ${voice.difficultyLevel}`,
        `- Barge-in: ${voice.bargeIn ? "sí" : "no"}`,
        `- Cliente en vivo: ${layer.motorEnabled ? "sí" : "no"}`,
        `- Tono: ${layer.toneId}`,
      ].join("\n"),
    );
  }

  if (input.settings.includeTeams && input.teamHint) {
    sections.push(`Equipo / examen:\n${input.teamHint}`);
  }

  return sections.join("\n\n");
}
