import type { ScenarioContextUpload } from "./types";

const SUPPORTED_TEXT_EXTENSIONS = new Set(["txt", "md"]);

export function emptyScenarioContext(): ScenarioContextUpload {
  return { text: "" };
}

export function mergeScenarioContextText(
  current: ScenarioContextUpload | undefined,
  addition: string,
): ScenarioContextUpload {
  const base = current?.text?.trim() ?? "";
  const next = addition.trim();
  if (!next) return current ?? emptyScenarioContext();
  return {
    text: base ? `${base}\n\n${next}` : next,
    fileName: current?.fileName,
    uploadedAt: current?.uploadedAt ?? new Date().toISOString(),
  };
}

export async function extractTextFromScenarioFile(
  file: File,
): Promise<{ text: string; unsupportedFormat?: boolean }> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (SUPPORTED_TEXT_EXTENSIONS.has(extension)) {
    return { text: (await file.text()).trim() };
  }

  if (extension === "pdf" || extension === "docx") {
    return { text: "", unsupportedFormat: true };
  }

  throw new Error("Formato no soportado. Usa .txt, .md o pega el texto.");
}

export function scenarioContextSnippet(
  context: ScenarioContextUpload | undefined,
  maxLength = 240,
): string {
  const text = context?.text?.trim() ?? "";
  if (!text) return "";
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`;
}
