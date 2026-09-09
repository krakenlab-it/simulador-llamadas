import { describe, expect, it } from "vitest";
import {
  emptyScenarioContext,
  extractTextFromScenarioFile,
  mergeScenarioContextText,
} from "@/lib/kraken-lab/scenario-context";

describe("Kraken Lab scenario context", () => {
  it("merges uploaded text into cohort context", () => {
    const merged = mergeScenarioContextText(emptyScenarioContext(), "Brief inicial");
    expect(merged.text).toBe("Brief inicial");
    expect(merged.uploadedAt).toBeTruthy();
  });

  it("extracts plain text from txt uploads", async () => {
    const file = new File(["Producto: Kraken Flow\nObjeción: ya tenemos ERP"], "brief.txt", {
      type: "text/plain",
    });

    const result = await extractTextFromScenarioFile(file);
    expect(result.text).toContain("Kraken Flow");
    expect(result.unsupportedFormat).toBeUndefined();
  });

  it("flags pdf/docx as unsupported for now", async () => {
    const pdf = new File(["%PDF"], "brief.pdf", { type: "application/pdf" });
    const docx = new File(["PK"], "brief.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    expect(await extractTextFromScenarioFile(pdf)).toEqual({
      text: "",
      unsupportedFormat: true,
    });
    expect(await extractTextFromScenarioFile(docx)).toEqual({
      text: "",
      unsupportedFormat: true,
    });
  });
});
