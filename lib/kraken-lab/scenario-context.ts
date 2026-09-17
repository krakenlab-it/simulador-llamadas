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
    ...(current ?? emptyScenarioContext()),
    text: base ? `${base}\n\n${next}` : next,
    uploadedAt: current?.uploadedAt ?? new Date().toISOString(),
  };
}

export function appendScenarioContextFile(
  current: ScenarioContextUpload | undefined,
  file: { id: string; name: string; text: string },
): ScenarioContextUpload {
  const base = current ?? emptyScenarioContext();
  const files = [...(base.files ?? []).filter((entry) => entry.id !== file.id), file];
  return {
    ...base,
    files,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
  };
}

export function removeScenarioContextFile(
  current: ScenarioContextUpload | undefined,
  fileId: string,
): ScenarioContextUpload {
  const base = current ?? emptyScenarioContext();
  return {
    ...base,
    files: (base.files ?? []).filter((entry) => entry.id !== fileId),
  };
}

export function fullScenarioContextText(
  context: ScenarioContextUpload | undefined,
): string {
  const parts = [
    context?.text?.trim() ?? "",
    ...(context?.files ?? []).map((file) => file.text.trim()).filter(Boolean),
  ].filter(Boolean);
  return parts.join("\n\n");
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
  const text = fullScenarioContextText(context);
  if (!text) return "";
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`;
}
