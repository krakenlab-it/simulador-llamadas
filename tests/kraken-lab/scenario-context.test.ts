import { describe, expect, it } from "vitest";
import {
  appendScenarioContextFile,
  emptyScenarioContext,
  extractTextFromScenarioFile,
  fullScenarioContextText,
  mergeScenarioContextText,
  removeScenarioContextFile,
} from "@/lib/kraken-lab/scenario-context";

describe("Kraken Lab scenario context", () => {
  it("merges uploaded text into cohort context", () => {
    const merged = mergeScenarioContextText(emptyScenarioContext(), "Brief inicial");
    expect(merged.text).toBe("Brief inicial");
    expect(merged.uploadedAt).toBeTruthy();
  });

  it("combines pasted text and uploaded file text", () => {
    const context = appendScenarioContextFile(
      { text: "Texto pegado" },
      { id: "f1", name: "brief.txt", text: "Contenido del archivo" },
    );
    expect(fullScenarioContextText(context)).toBe(
      "Texto pegado\n\nContenido del archivo",
    );
  });

  it("removes an uploaded file from context", () => {
    const context = removeScenarioContextFile(
      appendScenarioContextFile(emptyScenarioContext(), {
        id: "f1",
        name: "brief.txt",
        text: "Contenido",
      }),
      "f1",
    );
    expect(context.files).toHaveLength(0);
    expect(fullScenarioContextText(context)).toBe("");
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
