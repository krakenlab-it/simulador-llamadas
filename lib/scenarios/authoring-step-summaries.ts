import {
  callTypeLabel,
  type AuthoringStep,
  type ScenarioAuthoringDraft,
} from "./authoring";

function truncate(text: string, max = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function summarizeAuthoringStep(
  step: AuthoringStep,
  draft: ScenarioAuthoringDraft,
): string {
  switch (step) {
    case "persona": {
      const parts: string[] = [];
      if (draft.clientName.trim()) {
        parts.push(
          draft.clientTitle.trim()
            ? `${draft.clientName} (${draft.clientTitle})`
            : draft.clientName,
        );
      }
      if (draft.industry.trim()) parts.push(draft.industry.trim());
      if (draft.productSold.trim()) {
        parts.push(`Producto: ${truncate(draft.productSold, 44)}`);
      }
      if (draft.companyContext.trim()) {
        parts.push(truncate(draft.companyContext, 44));
      }
      if (draft.clientProblem.trim()) {
        parts.push(`Problema: ${truncate(draft.clientProblem, 44)}`);
      }
      return parts.join(" · ");
    }
    case "beats": {
      const filled = draft.rounds.filter(
        (round) => round.label.trim() || round.goal.trim() || round.clientPrompt.trim(),
      );
      if (filled.length === 0) return "";
      const labels = filled
        .map((round) => round.label.trim() || round.key)
        .slice(0, 5);
      return `${filled.length} fase(s): ${labels.join(" → ")}`;
    }
    case "success": {
      const parts: string[] = [];
      if (draft.winCriteria.trim()) parts.push(truncate(draft.winCriteria, 72));
      if (draft.callType) parts.push(callTypeLabel(draft.callType));
      const objectionCount = draft.objections.filter((objection) => objection.trim()).length;
      if (objectionCount > 0) parts.push(`${objectionCount} objeción(es)`);
      return parts.join(" · ");
    }
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}
