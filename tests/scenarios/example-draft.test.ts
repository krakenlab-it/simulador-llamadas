import { describe, expect, it } from "vitest";
import {
  authoringDraftHasContent,
  buildExampleAuthoringDraft,
} from "@/lib/scenarios/example-draft";
import { emptyAuthoringDraft } from "@/lib/scenarios/authoring";

describe("example authoring draft", () => {
  it("fills the Valeria Soto / Importadora del Norte example pack", () => {
    const draft = buildExampleAuthoringDraft();

    expect(draft.clientName).toBe("Valeria Soto");
    expect(draft.companyContext).toContain("Importadora del Norte");
    expect(draft.productSold).toContain("Kraken Flow");
    expect(draft.rounds).toHaveLength(5);
    expect(draft.winCriteria.toLowerCase()).toMatch(/jueves/);
  });

  it("detects when a draft already has content", () => {
    expect(authoringDraftHasContent(emptyAuthoringDraft())).toBe(false);
    expect(authoringDraftHasContent(buildExampleAuthoringDraft())).toBe(true);
  });
});
