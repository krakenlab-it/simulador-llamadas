import { personalityHint } from "@/lib/voice/agent-settings";
import type { ScenarioAuthoringDraft } from "@/lib/scenarios/authoring";
import type {
  AgentHarnessSettings,
  PublicScenarioSummary,
} from "./types";

export interface AgentContextInput {
  settings: AgentHarnessSettings;
  catalog: PublicScenarioSummary[];
  draft: ScenarioAuthoringDraft | null;
}

export function packAgentContext(input: AgentContextInput): string {
  const sections: string[] = [];
  const { settings } = input;

  if (settings.includeCatalog) {
    if (input.catalog.length === 0) {
      sections.push("## Catálogo\n(vacío en esta sesión)");
    } else {
      const lines = input.catalog.slice(0, 12).map((item) => {
        const kind = item.isPreset ? "preset" : "custom";
        const industry = item.industry ? ` · ${item.industry}` : "";
        return `- ${item.clientName} (${item.clientTitle}${industry}) [${kind}/${item.slug}]`;
      });
      sections.push(`## Catálogo\n${lines.join("\n")}`);
    }
  }

  if (settings.includeDraft) {
    if (!input.draft) {
      sections.push("## Borrador actual\n(ninguno)");
    } else {
      sections.push(
        [
          "## Borrador actual",
          `- Cliente: ${input.draft.clientName || "(sin nombre)"} · ${input.draft.clientTitle || "(sin rol)"}`,
          `- Empresa: ${input.draft.companyContext || "(sin contexto)"}`,
          `- Industria / producto: ${input.draft.industry || "—"} / ${input.draft.productSold || "—"}`,
          `- Problema: ${input.draft.clientProblem || "—"}`,
          `- Tipo: ${input.draft.callType} · idioma ${input.draft.language}`,
          `- Éxito: ${input.draft.winCriteria || "—"}`,
        ].join("\n"),
      );
    }
  }

  if (settings.includeVoiceSettings) {
    const voice = settings.voiceAgent;
    sections.push(
      [
        "## Voz del cliente simulado",
        `- Idioma: ${voice.language}`,
        `- Personalidad: ${personalityHint(voice.personality)}`,
        `- Ritmo: ${voice.speakingRate}`,
        `- Dificultad: ${voice.difficultyLevel}`,
        `- Interrumpir: ${voice.bargeIn ? "sí" : "no"}`,
      ].join("\n"),
    );
  }

  return sections.join("\n\n");
}
